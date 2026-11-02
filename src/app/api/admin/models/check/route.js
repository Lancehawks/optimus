import { withAdmin, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { getModel } from "@/lib/ai/models";
import { getProvider } from "@/lib/ai/providers";
import { assistantDb, workspaceContext } from "@/lib/assistant/server";
import { loadKey } from "@/lib/assistant/keys";
import { listModelStatuses, recordModelCheck } from "@/lib/assistant/modelAdmin";
import { runModelCheck } from "@/lib/assistant/modelCheck";
import { checkRateLimits } from "@/lib/rateLimit";
import { logError, logInfo } from "@/lib/logger";

// A check takes a few model calls.
export const maxDuration = 60;

// Runs the live model check on the admin's own key for that provider, or on
// the workspace key when it covers the provider. Test data only.
export const POST = withAdmin(async (request) => {
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  const model = typeof body.modelKey === "string" ? getModel(body.modelKey) : null;
  if (!model) return apiError("Unknown model", 404);
  const provider = getProvider(model.provider);
  if (!provider) return apiError("Unknown provider", 404);

  try {
    const rateLimit = await checkRateLimits(request, [
      { scope: "admin:model-check", identifier: request.user.id, limit: 30, windowMs: 60 * 60 * 1000, perIp: false },
    ]);
    if (!rateLimit.allowed) return apiError("Too many checks. Try again later.", 429);

    const ownKey = await loadKey(assistantDb, request.user.id, model.provider);
    const workspace = workspaceContext();
    const useWorkspace = !ownKey && workspace.configured && workspace.models.some((entry) => entry.key === model.key);
    if (!ownKey && !useWorkspace) {
      return apiError(`Add your own ${model.provider === "openrouter" ? "OpenRouter" : "Anthropic"} key in Settings to check this model.`, 409);
    }

    let result;
    try {
      result = await runModelCheck({ provider, model, apiKey: ownKey, signal: request.signal });
    } catch (error) {
      if (provider.isAbortError(error)) return apiError("The check was cancelled", 499);
      const message = provider.describeError?.(error, { ownKey: Boolean(ownKey) });
      if (!message) throw error;
      // Not the model's fault (rate limit, credits, outage): nothing is recorded.
      return apiError(`The check couldn't run: ${message}`, 502);
    }

    await recordModelCheck(assistantDb, model.key, result, { actorId: request.user.id });
    logInfo("admin.model_checked", { actorId: request.user.id, model: model.key, passed: result.passed });
    const models = await listModelStatuses(assistantDb);
    return apiNoStoreResponse({ model: models.find((entry) => entry.key === model.key), costUsd: result.costUsd });
  } catch (error) {
    logError("admin.model_check_failed", error, { actorId: request.user.id, model: model.key });
    return apiError("The check failed to run", 500);
  }
});
