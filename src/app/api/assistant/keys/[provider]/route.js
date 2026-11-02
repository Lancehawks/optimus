import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { getProvider } from "@/lib/ai/providers";
import { assistantDb } from "@/lib/assistant/server";
import { KeyError, cleanApiKey, deleteKey, requireProvider, saveKey } from "@/lib/assistant/keys";
import { checkRateLimits } from "@/lib/rateLimit";
import { logError, logInfo } from "@/lib/logger";

// Saves a key only after the provider accepts it. The key is never logged or
// returned; the response carries its hint.
export const PUT = withAuth(async (request, { params }) => {
  const { provider: providerId } = await params;
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  try {
    requireProvider(providerId);
    const apiKey = cleanApiKey(body.key);
    const rateLimit = await checkRateLimits(request, [
      { scope: "assistant:key:save", identifier: request.user.id, limit: 10, windowMs: 60 * 60 * 1000, perIp: false },
    ]);
    if (!rateLimit.allowed) return apiError("Too many attempts. Try again later.", 429);

    const check = await getProvider(providerId).validateKey(apiKey);
    if (!check.ok) return apiError(check.error, 400);
    const key = await saveKey(assistantDb, request.user.id, providerId, apiKey);
    logInfo("assistant.key_saved", { userId: request.user.id, provider: providerId });
    return apiNoStoreResponse({ key });
  } catch (error) {
    if (error instanceof KeyError) return apiError(error.message, error.status);
    logError("assistant.key_save_failed", error, { userId: request.user.id, provider: providerId });
    return apiError("Couldn't check the key with the provider right now. Try again shortly.", 502);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const { provider: providerId } = await params;
  try {
    const deleted = await deleteKey(assistantDb, request.user.id, providerId);
    if (!deleted) return apiError("No key saved for this provider", 404);
    logInfo("assistant.key_removed", { userId: request.user.id, provider: providerId });
    return apiNoStoreResponse({ deleted: true });
  } catch (error) {
    if (error instanceof KeyError) return apiError(error.message, error.status);
    logError("assistant.key_delete_failed", error, { userId: request.user.id, provider: providerId });
    return apiError("Could not remove the key", 500);
  }
});
