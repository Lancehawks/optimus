import Anthropic from "@anthropic-ai/sdk";
import { conversationEntries } from "./history.js";

// Claude through the official Anthropic SDK. The adapter owns everything
// Anthropic-specific: how stored rows become a request, prompt caching,
// thinking, and how a response maps back to the provider-neutral turn the
// assistant loop works with (see ./index.js).

const MAX_OUTPUT_TOKENS = 16_000;
const REQUEST_TIMEOUT_MS = 50_000;
const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01";
const EMPTY_REPLY = "(No reply.)";

let sharedClient = null;

// The workspace key comes from the environment; a member's own key is passed
// per request and never mixed with workspace credentials.
function clientFor(apiKey) {
  if (apiKey) return new Anthropic({ apiKey, authToken: null, timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 });
  sharedClient ||= new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 });
  return sharedClient;
}

export function isAnthropicConfigured(env = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
}

function toolResultBlock(result) {
  return {
    type: "tool_result",
    tool_use_id: result.id,
    content: JSON.stringify(result.output ?? null),
    ...(result.isError ? { is_error: true } : {}),
  };
}

// Rows stored before conversations could switch models carry no provider;
// they all came from Anthropic.
const isAnthropicRow = (row) => (row.provider ?? "anthropic") === "anthropic";

// Stored rows are append-only and render the same way on every request, which
// keeps both the prompt cache and earlier reasoning blocks valid. Responses
// from other Claude models replay as stored (the API drops reasoning a model
// can't read); responses from other providers arrive as plain text.
export function buildAnthropicMessages(history, { systemMessages = true } = {}) {
  const messages = [];
  for (const entry of conversationEntries(history, isAnthropicRow)) {
    if (entry.type === "input") {
      const { row } = entry;
      const context = row.payload?.context;
      if (context && !systemMessages) {
        messages.push({
          role: "user",
          content: [{ type: "text", text: row.content }, { type: "text", text: context }],
        });
        continue;
      }
      messages.push({ role: "user", content: [{ type: "text", text: row.content }] });
      // A system message must be last or followed by an assistant turn. An
      // input that never got a reply (a failed request) drops its note, which
      // is safe because nothing was produced against it.
      if (context && (entry.answered || entry.last)) {
        messages.push({ role: "system", content: context });
      }
    } else if (entry.type === "model") {
      messages.push({ role: "assistant", content: entry.row.payload.content });
    } else if (entry.type === "results") {
      messages.push({ role: "user", content: entry.row.payload.results.map(toolResultBlock) });
    } else if (entry.type === "text") {
      messages.push({ role: "assistant", content: [{ type: "text", text: entry.text }] });
    }
  }
  return messages;
}

export function buildAnthropicRequest({ model, system, memory = null, tools, history, finalStep = false }) {
  return {
    model: model.id,
    max_tokens: MAX_OUTPUT_TOKENS,
    // The shared instructions are cached across every conversation; the
    // member's memory follows them and is fixed for the conversation's life.
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ...(memory ? [{ type: "text", text: memory }] : []),
    ],
    // Tool inputs here are a few short fields, so eager input streaming is
    // left off: the API validates each input before it is stored and replayed.
    // Plain writing requests send no tools.
    ...(tools.length > 0 ? {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      })),
    } : {}),
    messages: buildAnthropicMessages(history, { systemMessages: model.systemMessages }),
    thinking: { type: "adaptive" },
    output_config: { effort: model.effort },
    // Caches the growing conversation tail; the system breakpoint above keeps
    // tools and instructions cached independently of it.
    cache_control: { type: "ephemeral" },
    ...(finalStep && tools.length > 0 ? { tool_choice: { type: "none" } } : {}),
  };
}

function usageFrom(message) {
  const usage = message.usage || {};
  return {
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
  };
}

export function turnFromAnthropicMessage(message) {
  const content = Array.isArray(message.content) ? message.content : [];
  const text = content.filter((block) => block.type === "text").map((block) => block.text).join("");
  const toolUses = content.filter((block) => block.type === "tool_use");
  const usage = usageFrom(message);

  // A refusal can cut a tool call off mid-input, and a reply truncated at the
  // output limit may carry an incomplete one. Neither runs tools; only the
  // visible text is kept so the stored turn is a valid assistant message.
  const truncatedToolCall = message.stop_reason === "max_tokens" && toolUses.length > 0;
  if (message.stop_reason === "refusal" || truncatedToolCall) {
    return {
      text,
      toolCalls: [],
      payload: { content: [{ type: "text", text: text || EMPTY_REPLY }] },
      stopReason: message.stop_reason === "refusal" ? "refusal" : "max_tokens",
      refusalCategory: message.stop_details?.category || null,
      usage,
    };
  }

  // A reply with only reasoning blocks gets a text block after them, so the
  // stored turn replays as a complete assistant message.
  const replayable = text || toolUses.length > 0 ? content : [...content, { type: "text", text: EMPTY_REPLY }];
  return {
    text,
    toolCalls: toolUses.map((block) => ({ id: block.id, name: block.name, input: block.input })),
    payload: { content: replayable },
    stopReason: toolUses.length > 0 ? "tool_calls" : message.stop_reason === "max_tokens" ? "max_tokens" : "end",
    refusalCategory: null,
    usage,
  };
}

// A message the member can act on, or null for an unexpected failure.
export function describeAnthropicError(error, { ownKey = false } = {}) {
  if (error instanceof Anthropic.RateLimitError) return "Anthropic is limiting requests right now. Try again in a minute.";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return ownKey
      ? "Anthropic didn't accept your API key. Check it in Settings → API keys."
      : "The workspace AI key isn't working. Let an admin know.";
  }
  if (error instanceof Anthropic.InternalServerError) return "Anthropic is having trouble right now. Try again shortly.";
  return null;
}

export function createAnthropicProvider({ client, createClient } = {}) {
  return {
    id: "anthropic",
    isConfigured: () => Boolean(client) || isAnthropicConfigured(),
    isAbortError: (error) => error instanceof Anthropic.APIUserAbortError,
    isRateLimitError: (error) => error instanceof Anthropic.RateLimitError,
    describeError: describeAnthropicError,
    // Lists one model: free, and fails only for a key Anthropic doesn't accept.
    async validateKey(apiKey) {
      const api = createClient ? createClient(apiKey) : new Anthropic({ apiKey, authToken: null, maxRetries: 0, timeout: 15_000 });
      try {
        await api.models.list({ limit: 1 });
        return { ok: true };
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          return { ok: false, error: "Anthropic didn't accept this key." };
        }
        throw error;
      }
    },
    async *streamTurn({ model, system, memory = null, tools, history, finalStep = false, signal, apiKey = null }) {
      const api = client || clientFor(apiKey);
      const body = buildAnthropicRequest({ model, system, memory, tools, history, finalStep });
      // Sonnet and Opus can retry a safety decline on another Claude model
      // inside the same call. Haiku has no server-side fallback.
      const stream = model.serverFallback
        ? api.beta.messages.stream({ ...body, betas: [SERVER_FALLBACK_BETA], fallbacks: "default" }, { signal })
        : api.messages.stream(body, { signal });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      const message = await stream.finalMessage();
      yield { type: "turn", turn: turnFromAnthropicMessage(message) };
    },
  };
}
