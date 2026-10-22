import { createAnthropicProvider } from "./anthropic.js";
import { createOpenRouterProvider } from "./openrouter.js";

// Provider adapters share one contract, so the assistant loop never sees a
// provider's request or response format:
//
//   isConfigured()          whether this server has a workspace key for it
//   validateKey(apiKey)     { ok } or { ok: false, error } for a member's key
//   describeError(error, { ownKey })  a message the member can act on, or null
//   isAbortError(error)     the request was cancelled by the caller
//   isRateLimitError(error)
//   streamTurn({ model, system, memory, tools, history, finalStep, signal, apiKey })
//     an async generator that yields { type: "text", text } as reply text
//     arrives, then one { type: "turn", turn } with:
//       text        visible reply text
//       toolCalls   [{ id, name, input }]
//       payload     the provider-native response; stored verbatim and only
//                   ever replayed to the same provider (and, where it matters,
//                   the same model)
//       stopReason  "end" | "tool_calls" | "refusal" | "max_tokens"
//       usage       { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd? }
//                   costUsd is the provider's own charge when it reports one
//
// `tools` are { name, description, parameters } with JSON Schema parameters,
// `history` is the conversation's stored rows (see lib/assistant/store.js),
// `memory` is the member's notes about themselves or null, fixed for a
// conversation, and `apiKey` is the member's own key, or null for the
// workspace key. A conversation can switch models; rows another provider
// produced are rendered as plain text (see ./history.js).

const factories = {
  anthropic: createAnthropicProvider,
  openrouter: createOpenRouterProvider,
};

const instances = new Map();

export function getProvider(id) {
  const factory = factories[id];
  if (!factory) return null;
  if (!instances.has(id)) instances.set(id, factory());
  return instances.get(id);
}
