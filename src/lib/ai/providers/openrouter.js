import { conversationEntries } from "./history.js";

// Models through OpenRouter's OpenAI-compatible chat completions API, always
// with the member's own OpenRouter key. Replies stream as Server-Sent Events;
// the pieces are assembled into one message (text, tool calls, reasoning) and
// the final chunk carries the actual charge in `usage.cost`.

const API_URL = "https://openrouter.ai/api/v1";
const MAX_OUTPUT_TOKENS = 12_000;
const REQUEST_TIMEOUT_MS = 50_000;
const EMPTY_REPLY = "(No reply.)";
const FINAL_STEP_NOTE = "\n\nYou have used all your lookups for this message. Answer now with what you have, without calling a tool.";

export class OpenRouterError extends Error {
  constructor(message, { status = null, code = null, metadata = null } = {}) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.code = code;
    this.metadata = metadata;
  }
}

function headers(apiKey) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    // OpenRouter's optional app attribution.
    "X-Title": "Optimus",
    ...(siteUrl && /^https:\/\//.test(siteUrl) ? { "HTTP-Referer": siteUrl } : {}),
  };
}

// Responses OpenRouter produced for this exact model replay as stored;
// anything else (another model, another provider) arrives as plain text.
const nativeTo = (model) => (row) => row.provider === "openrouter" && row.model === model.id;

export function buildOpenRouterMessages({ model, system, memory = null, history, finalStep = false }) {
  const instructions = [system, memory].filter(Boolean).join("\n\n")
    + (finalStep && !model.supportsToolChoice ? FINAL_STEP_NOTE : "");
  const messages = [{ role: "system", content: instructions }];
  for (const entry of conversationEntries(history, nativeTo(model))) {
    if (entry.type === "input") {
      const context = entry.row.payload?.context;
      messages.push({ role: "user", content: context ? `${entry.row.content}\n\n${context}` : entry.row.content });
    } else if (entry.type === "model") {
      messages.push(entry.row.payload.message);
    } else if (entry.type === "results") {
      for (const result of entry.row.payload.results) {
        messages.push({ role: "tool", tool_call_id: result.id, content: JSON.stringify(result.output ?? null) });
      }
    } else if (entry.type === "text") {
      messages.push({ role: "assistant", content: entry.text });
    }
  }
  return messages;
}

export function buildOpenRouterRequest({ model, system, memory = null, tools, history, finalStep = false }) {
  return {
    model: model.id,
    stream: true,
    messages: buildOpenRouterMessages({ model, system, memory, history, finalStep }),
    // OpenRouter validates the tool schemas on every request, results included.
    // Plain writing requests send no tools, and then no tool_choice either.
    ...(tools.length > 0 ? {
      tools: tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })),
      // Some free models don't accept tool_choice; sending it would leave no
      // provider able to serve the request.
      ...(model.supportsToolChoice ? { tool_choice: finalStep ? "none" : "auto" } : {}),
    } : {}),
    max_tokens: MAX_OUTPUT_TOKENS,
    ...(model.reasoningEffort ? { reasoning: { effort: model.reasoningEffort } } : {}),
    // Only route to provider endpoints that support every parameter sent,
    // tools included, rather than ones that would silently ignore them.
    provider: { require_parameters: true },
  };
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((part) => part?.type === "text").map((part) => part.text).join("");
  return "";
}

function parseArguments(value) {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    // runTool reports a non-object input back to the model as an error.
    return null;
  }
}

function usageFrom(usage = {}) {
  const prompt = usage.prompt_tokens || 0;
  const cacheRead = usage.prompt_tokens_details?.cached_tokens || 0;
  const cacheWrite = usage.prompt_tokens_details?.cache_write_tokens || 0;
  return {
    inputTokens: Math.max(0, prompt - cacheRead - cacheWrite),
    outputTokens: usage.completion_tokens || 0,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    costUsd: typeof usage.cost === "number" ? usage.cost : null,
  };
}

export function turnFromOpenRouterResponse(body) {
  const choice = body?.choices?.[0];
  if (!choice) throw new OpenRouterError("OpenRouter returned no reply");
  if (choice.finish_reason === "error") {
    throw new OpenRouterError(choice.error?.message || "The model failed to answer", { code: choice.error?.code });
  }
  const message = choice.message || {};
  const text = textOf(message.content);
  const usage = usageFrom(body.usage);
  const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  // A filtered reply or one cut off mid tool call runs no tools; only its text
  // is kept, so the stored turn replays as a plain assistant message.
  const cutOffCall = choice.finish_reason === "length" && rawCalls.length > 0;
  if (choice.finish_reason === "content_filter" || cutOffCall) {
    return {
      text,
      toolCalls: [],
      payload: { message: { role: "assistant", content: text || EMPTY_REPLY } },
      stopReason: cutOffCall ? "max_tokens" : "refusal",
      refusalCategory: null,
      usage,
    };
  }

  const toolCalls = rawCalls.map((call, index) => ({ ...call, id: call.id || `call_${index}` }));
  // Reasoning is passed back unchanged so the model can continue it after
  // tool results arrive, unless the stream only gave placeholders for it.
  const details = Array.isArray(message.reasoning_details) ? message.reasoning_details : [];
  const redacted = details.some((detail) => ["text", "summary", "data"].some((field) => detail[field] === "[REDACTED]"));
  const reasoning = details.length > 0 && !redacted
    ? { reasoning_details: details }
    : message.reasoning && message.reasoning !== "[REDACTED]" ? { reasoning: message.reasoning } : {};
  const stored = {
    role: "assistant",
    content: text || (toolCalls.length > 0 ? null : EMPTY_REPLY),
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    ...reasoning,
  };
  return {
    text,
    toolCalls: toolCalls.map((call) => ({ id: call.id, name: call.function?.name, input: parseArguments(call.function?.arguments) })),
    payload: { message: stored },
    stopReason: toolCalls.length > 0 ? "tool_calls" : choice.finish_reason === "length" ? "max_tokens" : "end",
    refusalCategory: null,
    usage,
  };
}

async function errorFrom(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const detail = body?.error || {};
  return new OpenRouterError(detail.message || `OpenRouter answered ${response.status}`, {
    status: response.status,
    code: detail.code ?? null,
    metadata: detail.metadata ?? null,
  });
}

// Streamed pieces of one reply, assembled into the message a non-streamed
// response would have returned.
function mergeReasoningDetail(list, detail) {
  const existing = detail.index === undefined
    ? null
    : list.find((entry) => entry.index === detail.index && entry.type === detail.type);
  if (!existing) {
    list.push({ ...detail });
    return;
  }
  for (const field of ["text", "summary", "data"]) {
    if (typeof detail[field] === "string") existing[field] = (existing[field] || "") + detail[field];
  }
  for (const field of ["signature", "id", "format"]) {
    if (detail[field]) existing[field] = detail[field];
  }
}

export function createStreamAccumulator() {
  let content = "";
  let reasoning = "";
  const toolCalls = [];
  const reasoningDetails = [];
  let finishReason = null;
  let usage = null;
  let error = null;

  return {
    // Returns the visible text this chunk added.
    add(chunk) {
      if (chunk.usage) usage = chunk.usage;
      if (chunk.error) error = chunk.error;
      const choice = chunk.choices?.[0];
      if (!choice) return "";
      if (choice.finish_reason) finishReason = choice.finish_reason;
      if (choice.error) error = choice.error;
      const delta = choice.delta || {};
      if (typeof delta.reasoning === "string") reasoning += delta.reasoning;
      for (const detail of delta.reasoning_details || []) mergeReasoningDetail(reasoningDetails, detail);
      for (const part of delta.tool_calls || []) {
        const index = part.index ?? toolCalls.length;
        const call = (toolCalls[index] ||= { id: undefined, type: "function", function: { name: "", arguments: "" } });
        if (part.id) call.id = part.id;
        if (part.type) call.type = part.type;
        const name = part.function?.name;
        if (name) call.function.name = !call.function.name || call.function.name === name ? name : call.function.name + name;
        if (part.function?.arguments) call.function.arguments += part.function.arguments;
      }
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        return delta.content;
      }
      return "";
    },
    error: () => error,
    response() {
      const calls = toolCalls.filter(Boolean);
      return {
        choices: [{
          finish_reason: finishReason || (calls.length > 0 ? "tool_calls" : "stop"),
          message: {
            role: "assistant",
            content: content || null,
            ...(calls.length > 0 ? { tool_calls: calls } : {}),
            ...(reasoningDetails.length > 0 ? { reasoning_details: reasoningDetails } : {}),
            ...(reasoning ? { reasoning } : {}),
          },
        }],
        usage: usage || {},
      };
    },
  };
}

// Server-Sent Event `data:` payloads from a response body. Lines starting
// with ":" are keep-alives; "[DONE]" ends the stream.
export async function* sseData(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          if (data) yield data;
        }
        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function describeOpenRouterError(error) {
  if (!(error instanceof OpenRouterError)) {
    if (error?.name === "TimeoutError") return "The model took too long to answer. Try again or pick another model.";
    return null;
  }
  if (error.status === 401) return "OpenRouter didn't accept your API key. Check it in Settings → API keys.";
  if (error.status === 402) return "Your OpenRouter account is out of credits or over its limit.";
  if (error.status === 403) return "Your OpenRouter key's budget blocks this request.";
  if (error.code === "free_daily_limit") {
    return "You've used today's free OpenRouter requests. They reset at midnight UTC. Pick another model to keep going.";
  }
  if (error.status === 429) {
    return "This model is busy or you're sending requests too quickly for it. Wait a minute, or pick another model.";
  }
  if (error.status === 404) return "OpenRouter couldn't find a provider for this model right now. Pick another model.";
  if (error.status >= 500) return "OpenRouter is having trouble right now. Try again shortly.";
  return null;
}

export function createOpenRouterProvider({ fetchImpl = globalThis.fetch } = {}) {
  return {
    id: "openrouter",
    // There is no workspace OpenRouter key; members always bring their own.
    isConfigured: () => false,
    isAbortError: (error) => error?.name === "AbortError",
    isRateLimitError: (error) => error instanceof OpenRouterError && error.status === 429,
    describeError: describeOpenRouterError,
    async validateKey(apiKey) {
      const response = await fetchImpl(`${API_URL}/key`, {
        headers: headers(apiKey),
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 401 || response.status === 403) return { ok: false, error: "OpenRouter didn't accept this key." };
      if (!response.ok) throw await errorFrom(response);
      return { ok: true };
    },
    // Today's free-model allowance for the account behind this key:
    // { used, limit, remaining } (resets at midnight UTC), or null if unknown.
    async freeQuota(apiKey) {
      try {
        const response = await fetchImpl(`${API_URL}/key`, { headers: headers(apiKey), signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return null;
        const body = await response.json();
        const quota = (body?.data ?? body)?.free_model_daily_requests;
        if (!quota || typeof quota.limit !== "number") return null;
        return {
          used: Number(quota.used) || 0,
          limit: quota.limit,
          remaining: typeof quota.remaining === "number" ? quota.remaining : Math.max(0, quota.limit - (Number(quota.used) || 0)),
        };
      } catch {
        return null;
      }
    },
    async *streamTurn({ model, system, memory = null, tools, history, finalStep = false, signal, apiKey }) {
      if (!apiKey) throw new OpenRouterError("An OpenRouter key is required", { status: 401 });
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const response = await fetchImpl(`${API_URL}/chat/completions`, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify(buildOpenRouterRequest({ model, system, memory, tools, history, finalStep })),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw await errorFrom(response);

      const accumulator = createStreamAccumulator();
      for await (const data of sseData(response.body)) {
        let chunk;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const text = accumulator.add(chunk);
        if (text) yield { type: "text", text };
        const failure = accumulator.error();
        if (failure) {
          // Mid-stream errors arrive with a 200 status; the stream ends here.
          throw new OpenRouterError(failure.message || "The model stopped with an error", {
            status: Number.isInteger(failure.code) ? failure.code : null,
            code: Number.isInteger(failure.code) ? null : failure.code ?? null,
            metadata: failure.metadata ?? null,
          });
        }
      }
      yield { type: "turn", turn: turnFromOpenRouterResponse(accumulator.response()) };
    },
  };
}
