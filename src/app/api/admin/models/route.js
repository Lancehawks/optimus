import { withAdmin, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { assistantDb, workspaceContext } from "@/lib/assistant/server";
import { keyProviders } from "@/lib/assistant/keys";
import { ModelAdminError, listModelStatuses, setModelEnabled } from "@/lib/assistant/modelAdmin";
import { logError, logInfo } from "@/lib/logger";

export const GET = withAdmin(async (request) => {
  try {
    const [models, adminKeys] = await Promise.all([
      listModelStatuses(assistantDb),
      keyProviders(assistantDb, request.user.id),
    ]);
    const workspace = workspaceContext();
    const workspaceKeys = workspace.models.map((model) => model.key);
    return apiNoStoreResponse({
      models,
      workspaceModels: workspaceKeys,
      workspaceDefault: workspace.defaultKey,
      // Checks run on the admin's own key for the provider, or on the
      // workspace key for the workspace models.
      canCheck: Object.fromEntries(models.map((model) => [
        model.key,
        adminKeys.has(model.provider) || (workspace.configured && workspaceKeys.includes(model.key)),
      ])),
    });
  } catch (error) {
    logError("admin.models_list_failed", error, { actorId: request.user.id });
    return apiError("Could not load models", 500);
  }
});

export const PATCH = withAdmin(async (request) => {
  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);
  if (typeof body.modelKey !== "string" || typeof body.enabled !== "boolean") {
    return apiError("modelKey and enabled are required");
  }
  try {
    await setModelEnabled(assistantDb, body.modelKey, body.enabled, { actorId: request.user.id });
    logInfo("admin.model_toggled", { actorId: request.user.id, model: body.modelKey, enabled: body.enabled });
    const models = await listModelStatuses(assistantDb);
    return apiNoStoreResponse({ model: models.find((model) => model.key === body.modelKey) });
  } catch (error) {
    if (error instanceof ModelAdminError) return apiError(error.message, error.status);
    logError("admin.model_toggle_failed", error, { actorId: request.user.id });
    return apiError("Could not update the model", 500);
  }
});
