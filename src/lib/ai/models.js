// Models the assistant can run on. A key is "<provider>:<model id>"; set
// AI_MODEL to one of these keys to change the model for new conversations.
// Adding another provider means adding its adapter under ./providers and its
// models here, with prices in US dollars per million tokens.

export const DEFAULT_MODEL_KEY = "anthropic:claude-haiku-5-5";

export const MODELS = {
  "anthropic:claude-haiku-5-5": {
    provider: "anthropic",
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    effort: "medium",
    systemMessages: true,
    serverFallback: false,
    pricing: {
      // Prompts above 100K tokens are billed on the higher card.
      tiers: [
        { maxPromptTokens: 100_000, input: 0.1, output: 0.5 },
        { maxPromptTokens: Infinity, input: 0.5, output: 2.5 },
      ],
      cacheReadMultiplier: 0.1,
      cacheWriteMultiplier: 1.25,
    },
  },
  "anthropic:claude-sonnet-5-5": {
    provider: "anthropic",
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    effort: "medium",
    systemMessages: true,
    serverFallback: true,
    pricing: {
      tiers: [{ maxPromptTokens: Infinity, input: 2, output: 10 }],
      cacheReadMultiplier: 0.1,
      cacheWriteMultiplier: 1.25,
    },
  },
  "anthropic:claude-opus-5-5": {
    provider: "anthropic",
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    effort: "medium",
    systemMessages: true,
    serverFallback: true,
    pricing: {
      tiers: [{ maxPromptTokens: Infinity, input: 4, output: 20 }],
      cacheReadMultiplier: 0.05,
      cacheWriteMultiplier: 1.25,
    },
  },
};

export function modelKey(provider, id) {
  return `${provider}:${id}`;
}

export function getModel(key) {
  const model = MODELS[key];
  return model ? { key, ...model } : null;
}

// The model new conversations start on. An unknown AI_MODEL is a deployment
// mistake, so it fails loudly instead of silently falling back.
export function resolveConfiguredModel(env = process.env) {
  const key = env.AI_MODEL?.trim() || DEFAULT_MODEL_KEY;
  const model = getModel(key);
  if (!model) throw new Error(`AI_MODEL "${key}" is not a known model`);
  return model;
}

export function estimateCostUsd(model, usage) {
  const pricing = model?.pricing;
  if (!pricing) return 0;
  const input = usage.inputTokens || 0;
  const cacheRead = usage.cacheReadTokens || 0;
  const cacheWrite = usage.cacheWriteTokens || 0;
  const output = usage.outputTokens || 0;
  const promptTokens = input + cacheRead + cacheWrite;
  const tier = pricing.tiers.find((entry) => promptTokens <= entry.maxPromptTokens) || pricing.tiers.at(-1);
  const dollars =
    input * tier.input
    + cacheRead * tier.input * pricing.cacheReadMultiplier
    + cacheWrite * tier.input * pricing.cacheWriteMultiplier
    + output * tier.output;
  return dollars / 1_000_000;
}
