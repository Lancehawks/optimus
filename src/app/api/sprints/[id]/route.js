import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { deleteSprint, getSprintDetail, updateSprint, validateSprintUpdate } from "@/lib/sprints";

const db = { query };

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Sprint", { allowNull: false }).error) return apiError("Sprint ID is invalid");

    const sprint = await getSprintDetail(db, request.user.id, id);
    if (!sprint) return apiError("Sprint not found", 404);
    return apiResponse({ sprint });
  } catch (error) {
    console.error("Sprint get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Sprint", { allowNull: false }).error) return apiError("Sprint ID is invalid");

    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateSprintUpdate(body);
    if (validation.error) return apiError(validation.error);

    const result = await updateSprint(db, request.user.id, id, validation.value);
    if (result.error) return apiError(result.error, result.status);
    return apiResponse({ sprint: result.sprint });
  } catch (error) {
    console.error("Sprint update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Sprint", { allowNull: false }).error) return apiError("Sprint ID is invalid");

    const deleted = await deleteSprint(db, request.user.id, id);
    if (!deleted) return apiError("Sprint not found", 404);
    return apiResponse({ message: "Sprint deleted" });
  } catch (error) {
    console.error("Sprint delete error:", error);
    return apiError("Internal server error", 500);
  }
});
