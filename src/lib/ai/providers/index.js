import { createAnthropicProvider } from "./anthropic.js";

// Provider adapters share one contract, so the assistant loop never sees a
// provider's request or response format:
//
//   isConfigured()        whether this server has credentials for it
//   isAbortError(error)   the request was cancelled by the caller
//   isRateLimitError(error)
//   streamTurn({ model, system, tools, history, finalStep, signal })
//     an async generator that yields { type: "text", text } while the reply
//     streams, then one { type: "turn", turn } with:
//       text        visible reply text
//       toolCalls   [{ id, name, input }]
//       payload     the provider-native response; stored verbatim and only
//                   ever replayed to the same provider
//       stopReason  "end" | "tool_calls" | "refusal" | "max_tokens"
//       usage       { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }
//
// `tools` are { name, description, parameters } with JSON Schema parameters,
// and `history` is the conversation's stored rows (see lib/assistant/store.js).

const factories = {
  anthropic: createAnthropicProvider,
};

const instances = new Map();

export function getProvider(id) {
  const factory = factories[id];
  if (!factory) return null;
  if (!instances.has(id)) instances.set(id, factory());
  return instances.get(id);
}
