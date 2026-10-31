import { transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject, uuidArray } from "@/lib/apiValidation";
import { addTasksToSprint, removeTasksFromSprint } from "@/lib/sprints";

async function readRequest(request, params) {
  const { id } = await params;
  if (optionalUuid(id, "Sprint", { allowNull: false }).error) return { error: "Sprint ID is invalid" };

  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return { error: bodyError };

  const taskIds = uuidArray(body.taskIds, "Tasks", { required: true, max: 100 });
  if (taskIds.error) return { error: taskIds.error };
  if (taskIds.value.length === 0) return { error: "Tasks is required" };

  return { id, taskIds: taskIds.value };
}

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id, taskIds, error } = await readRequest(request, params);
    if (error) return apiError(error);

    const result = await transaction((client) => addTasksToSprint(client, request.user.id, id, taskIds));
    if (result.error) return apiError(result.error, result.status);
    return apiResponse({ sprint: result.sprint });
  } catch (error) {
    console.error("Sprint add tasks error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id, taskIds, error } = await readRequest(request, params);
    if (error) return apiError(error);

    const result = await transaction((client) => removeTasksFromSprint(client, request.user.id, id, taskIds));
    if (result.error) return apiError(result.error, result.status);
    return apiResponse({ sprint: result.sprint });
  } catch (error) {
    console.error("Sprint remove tasks error:", error);
    return apiError("Internal server error", 500);
  }
});
