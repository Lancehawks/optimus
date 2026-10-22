import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { resolveConfiguredModel } from "@/lib/ai/models";
import { getProvider } from "@/lib/ai/providers";
import { assistantDb } from "@/lib/assistant/server";
import { setAssistantEnabled } from "@/lib/assistant/store";
import { logError } from "@/lib/logger";

function describeModel() {
  try {
    const model = resolveConfiguredModel();
    return { label: model.label, available: Boolean(getProvider(model.provider)?.isConfigured()) };
  } catch {
    return { label: null, available: false };
  }
}

export const GET = withAuth(async (request) => {
  const model = describeModel();
  return apiNoStoreResponse({
    enabledAt: request.user.ai_assistant_enabled_at || null,
    model: model.label,
    available: model.available,
  });
});

export const PUT = withAuth(async (request) => {
  try {
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);
    if (typeof body.enabled !== "boolean") return apiError("enabled must be true or false");

    const enabledAt = await setAssistantEnabled(assistantDb, request.user.id, body.enabled);
    return apiNoStoreResponse({ enabledAt });
  } catch (error) {
    logError("assistant.settings_update_failed", error, { userId: request.user.id });
    return apiError("Could not update the assistant setting", 500);
  }
});
