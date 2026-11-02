import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { getProvider } from "@/lib/ai/providers";
import { availableModels, defaultModelKey } from "@/lib/assistant/access";
import { loadKey } from "@/lib/assistant/keys";
import { assistantDb, workspaceContext } from "@/lib/assistant/server";
import { logError } from "@/lib/logger";

// The models this member can pick in the assistant, and which key pays for each.
export const GET = withAuth(async (request) => {
  try {
    const workspace = workspaceContext();
    const { options, providers } = await availableModels(assistantDb, request.user, workspace);
    // Today's free-model allowance on the member's OpenRouter account, so the
    // panel can warn before it runs out.
    let freeQuota = null;
    if (options.some((option) => option.free)) {
      const apiKey = await loadKey(assistantDb, request.user.id, "openrouter");
      freeQuota = apiKey ? await getProvider("openrouter").freeQuota(apiKey) : null;
    }
    return apiNoStoreResponse({
      freeQuota,
      models: options,
      selected: defaultModelKey(request.user, options, workspace.defaultKey),
      workspaceAccess: Boolean(request.user.ai_assistant_enabled_at),
      keyProviders: providers,
    });
  } catch (error) {
    logError("assistant.models_list_failed", error, { userId: request.user.id });
    return apiError("Could not load models", 500);
  }
});
