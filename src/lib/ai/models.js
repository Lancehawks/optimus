// Providers and models the assistant can run on. A model key is
// "<provider>:<model id>". The workspace key pays for the workspace models
// (AI_WORKSPACE_MODELS, default Haiku and Sonnet), with AI_MODEL as the
// default; members with their own key can pick any enabled model of that
// provider. Prices are US dollars per million tokens.

export const DEFAULT_MODEL_KEY = "anthropic:claude-haiku-5-5";
export const DEFAULT_WORKSPACE_MODEL_KEYS = ["anthropic:claude-haiku-5-5", "anthropic:claude-sonnet-5-5"];

export const PROVIDERS = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keyPlaceholder: "sk-ant-…",
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keyPlaceholder: "sk-or-…",
    keysUrl: "https://openrouter.ai/settings/keys",
  },
};

const anthropicPricing = (input, output, cacheReadMultiplier = 0.1, tiers = null) => ({
  tiers: tiers || [{ maxPromptTokens: Infinity, input, output }],
  cacheReadMultiplier,
  cacheWriteMultiplier: 1.25,
});

// OpenRouter reports the actual charge with every response; these list
// prices are only for display and as a fallback estimate.
const openRouterPricing = (input, output, cacheRead = null) => ({
  tiers: [{ maxPromptTokens: Infinity, input, output }],
  cacheReadMultiplier: cacheRead && input ? cacheRead / input : 1,
  cacheWriteMultiplier: 1,
});

// Paid OpenRouter models were chosen from those with tool support and an
// Artificial Analysis agentic index (a tool-use benchmark, shown as
// `agenticIndex`) of at least 40, as of October 2026. The free models are the
// workspace owner's choice; several have no published tool-use score yet.
// None is offered to members until an admin's live check passes.
const openRouter = (id, label, fields) => ({
  provider: "openrouter",
  id,
  label,
  defaultEnabled: false,
  systemMessages: false,
  supportsToolChoice: true,
  free: false,
  openWeights: false,
  ...fields,
});

export const MODELS = {
  "anthropic:claude-haiku-5-5": {
    provider: "anthropic",
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    defaultEnabled: true,
    effort: "medium",
    systemMessages: true,
    serverFallback: false,
    pricing: anthropicPricing(0.1, 0.5, 0.1, [
      // Prompts above 100K tokens are billed on the higher card.
      { maxPromptTokens: 100_000, input: 0.1, output: 0.5 },
      { maxPromptTokens: Infinity, input: 0.5, output: 2.5 },
    ]),
  },
  "anthropic:claude-sonnet-5-5": {
    provider: "anthropic",
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    defaultEnabled: true,
    effort: "medium",
    systemMessages: true,
    serverFallback: true,
    pricing: anthropicPricing(2, 10),
  },
  "anthropic:claude-opus-5-5": {
    provider: "anthropic",
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    defaultEnabled: true,
    effort: "medium",
    systemMessages: true,
    serverFallback: true,
    pricing: anthropicPricing(4, 20, 0.05),
  },
  "openrouter:openai/gpt-5.6-sol": openRouter("openai/gpt-5.6-sol", "GPT-5.6 Sol", {
    agenticIndex: 50.2, reasoningEffort: "low", pricing: openRouterPricing(2, 10, 0.2),
  }),
  "openrouter:openai/gpt-5.6-luna": openRouter("openai/gpt-5.6-luna", "GPT-5.6 Luna", {
    agenticIndex: 42.1, reasoningEffort: "low", pricing: openRouterPricing(0.1, 0.6, 0.01),
  }),
  "openrouter:anthropic/claude-sonnet-5": openRouter("anthropic/claude-sonnet-5", "Claude Sonnet 5", {
    agenticIndex: 43.6, reasoningEffort: "low", pricing: openRouterPricing(2, 10, 0.2),
  }),
  "openrouter:x-ai/grok-4.6": openRouter("x-ai/grok-4.6", "Grok 4.6", {
    agenticIndex: 53, reasoningEffort: "low", pricing: openRouterPricing(2, 6, 0.5),
  }),
  "openrouter:z-ai/glm-5.3-flash": openRouter("z-ai/glm-5.3-flash", "GLM 5.3 Flash", {
    agenticIndex: 50.9, reasoningEffort: "low", pricing: openRouterPricing(0.15, 0.5, 0.03),
  }),
  "openrouter:google/gemini-3.8-flash": openRouter("google/gemini-3.8-flash", "Gemini 3.8 Flash", {
    agenticIndex: 40.2, reasoningEffort: "low", pricing: openRouterPricing(0.375, 1.875, 0.0375),
  }),
  "openrouter:qwen/qwen3.8-27b": openRouter("qwen/qwen3.8-27b", "Qwen3.8 27B", {
    agenticIndex: 45.8, reasoningEffort: "low", openWeights: true, pricing: openRouterPricing(0.04, 1.35, 0.018),
  }),
  "openrouter:deepseek/deepseek-v4-flash-0731": openRouter("deepseek/deepseek-v4-flash-0731", "DeepSeek V4 Flash", {
    agenticIndex: 41, reasoningEffort: "low", openWeights: true, pricing: openRouterPricing(0.44, 1.32, 0.014),
  }),
  // Free models. Models without listed effort levels get no reasoning setting.
  "openrouter:minimax/minimax-m3.1-flash:free": openRouter("minimax/minimax-m3.1-flash:free", "MiniMax M3.1 Flash", {
    agenticIndex: null, free: true, reasoningEffort: "low", pricing: openRouterPricing(0, 0),
  }),
  "openrouter:nvidia/nemotron-3.5-super-vl:free": openRouter("nvidia/nemotron-3.5-super-vl:free", "Nemotron 3.5 Super VL", {
    agenticIndex: null, free: true, openWeights: true, pricing: openRouterPricing(0, 0),
  }),
  "openrouter:xingchen-agi/xing4.0-29b-a4b:free": openRouter("xingchen-agi/xing4.0-29b-a4b:free", "Xing4.0 29B A4B", {
    agenticIndex: null, free: true, pricing: openRouterPricing(0, 0),
  }),
  "openrouter:thinkingmachines/inkling:free": openRouter("thinkingmachines/inkling:free", "Inkling", {
    agenticIndex: 22.5, free: true, supportsToolChoice: false, reasoningEffort: "low", pricing: openRouterPricing(0, 0),
  }),
  "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free": openRouter("nvidia/nemotron-3-ultra-550b-a55b:free", "Nemotron 3 Ultra", {
    agenticIndex: 20.1, free: true, openWeights: true, reasoningEffort: "medium", pricing: openRouterPricing(0, 0),
  }),
};

export function modelKey(provider, id) {
  return `${provider}:${id}`;
}

export function getModel(key) {
  const model = MODELS[key];
  return model ? { key, ...model } : null;
}

export function listModels() {
  return Object.keys(MODELS).map(getModel);
}

// The workspace's default model. An unknown AI_MODEL is a deployment
// mistake, so it fails loudly instead of silently falling back.
export function resolveConfiguredModel(env = process.env) {
  const key = env.AI_MODEL?.trim() || DEFAULT_MODEL_KEY;
  const model = getModel(key);
  if (!model) throw new Error(`AI_MODEL "${key}" is not a known model`);
  return model;
}

// Every model the workspace key pays for, the default first. They must all be
// from the default model's provider, since there is one workspace key.
export function resolveWorkspaceModels(env = process.env) {
  const defaultModel = resolveConfiguredModel(env);
  const listed = env.AI_WORKSPACE_MODELS?.trim()
    ? env.AI_WORKSPACE_MODELS.split(",").map((key) => key.trim()).filter(Boolean)
    : DEFAULT_WORKSPACE_MODEL_KEYS;
  const models = listed.map((key) => {
    const model = getModel(key);
    if (!model) throw new Error(`AI_WORKSPACE_MODELS lists "${key}", which is not a known model`);
    if (model.provider !== defaultModel.provider) {
      throw new Error(`AI_WORKSPACE_MODELS lists "${key}", but the workspace key is for ${defaultModel.provider}`);
    }
    return model;
  });
  return [defaultModel, ...models.filter((model) => model.key !== defaultModel.key)];
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
