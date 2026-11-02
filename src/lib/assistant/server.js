import { query, transaction } from "@/lib/db";
import { resolveWorkspaceModels } from "@/lib/ai/models";
import { getProvider } from "@/lib/ai/providers";
import { logError } from "@/lib/logger";

// The assistant modules take a database handle so tests can pass their own.
export const assistantDb = { query, transaction };

// The models the workspace key pays for (the default first), its provider,
// and whether this server holds that key. A misconfigured AI_MODEL or
// AI_WORKSPACE_MODELS leaves members with their own keys only.
export function workspaceContext() {
  try {
    const models = resolveWorkspaceModels();
    const provider = models[0].provider;
    return { models, defaultKey: models[0].key, provider, configured: Boolean(getProvider(provider)?.isConfigured()) };
  } catch (error) {
    logError("assistant.model_misconfigured", error);
    return { models: [], defaultKey: null, provider: null, configured: false };
  }
}
