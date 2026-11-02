import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { assistantDb, workspaceContext } from "@/lib/assistant/server";
import { getAssistantAccess } from "@/lib/assistant/store";
import { logError } from "@/lib/logger";

function describeModels() {
  const workspace = workspaceContext();
  return {
    label: workspace.models.length ? workspace.models.map((model) => model.label).join(" or ") : null,
    available: workspace.configured,
  };
}

// Read-only for members: only admins turn the assistant on or off, from the
// admin page (PATCH /api/admin/members/[id]).
export const GET = withAuth(async (request) => {
  try {
    const access = await getAssistantAccess(assistantDb, request.user.id);
    const model = describeModels();
    return apiNoStoreResponse({
      enabledAt: access.enabledAt,
      enabledBy: access.enabledBy,
      model: model.label,
      available: model.available,
    });
  } catch (error) {
    logError("assistant.settings_load_failed", error, { userId: request.user.id });
    return apiError("Could not load the assistant setting", 500);
  }
});
