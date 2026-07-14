import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { creatorOrProjectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";
import {
  firstValidationError,
  optionalEnum,
  optionalInteger,
  optionalUuid,
  parseJsonObject,
  uuidArray,
} from "@/lib/apiValidation";

const BULK_ACTIONS = ["complete", "delete", "update_status", "archive", "reorder"];
const TASK_STATUSES = ["todo", "in_progress", "on_hold", "done"];

function createReorderAccessError() {
  const error = new Error("One or more tasks could not be reordered");
  error.status = 403;
  return error;
}

export const POST = withAuth(async (request) => {
  try {
    // Read body once to avoid the double-read bug in update_status.
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const { action, tasks: taskUpdates } = body;

    if (!BULK_ACTIONS.includes(action)) {
      return apiError("Invalid action");
    }

    // reorder uses taskUpdates, not taskIds
    const taskIdsResult = action === "reorder"
      ? { provided: false, value: [] }
      : uuidArray(body.taskIds, "Task IDs", { required: true, max: 500 });
    if (taskIdsResult.error) return apiError(taskIdsResult.error);
    const taskIds = taskIdsResult.value || [];

    if (action !== "reorder" && taskIds.length === 0) {
      return apiError("Task IDs are required");
    }

    const placeholders = taskIds.map((_, i) => `$${i + 2}`).join(", ");

    switch (action) {
      case "complete": {
        await query(
          `UPDATE tasks t SET status = 'done'
           WHERE id IN (${placeholders}) AND ${projectScopedAccessCondition("t")}`,
          [request.user.id, ...taskIds]
        );
        return apiResponse({ message: `${taskIds.length} tasks completed` });
      }
      case "delete": {
        const result = await query(
          `DELETE FROM tasks t
           WHERE id IN (${placeholders})
             AND ${projectScopedAccessCondition("t")}
             AND ${creatorOrProjectOwnerCondition("t")}
           RETURNING id`,
          [request.user.id, ...taskIds]
        );
        return apiResponse({
          message: `${result.rowCount} tasks deleted`,
          deletedCount: result.rowCount,
        });
      }
      case "update_status": {
        const status = optionalEnum(body.status, "Status", TASK_STATUSES);
        if (status.error || !status.provided) {
          return apiError(status.error || "Status is required");
        }

        await query(
          `UPDATE tasks t SET status = $${taskIds.length + 2}
           WHERE id IN (${placeholders}) AND ${projectScopedAccessCondition("t")}`,
          [request.user.id, ...taskIds, status.value]
        );
        return apiResponse({ message: `${taskIds.length} tasks updated` });
      }
      case "archive": {
        const result = await query(
          `UPDATE tasks t SET is_archived = true
           WHERE id IN (${placeholders})
             AND ${projectScopedAccessCondition("t")}
             AND ${creatorOrProjectOwnerCondition("t")}
           RETURNING id`,
          [request.user.id, ...taskIds]
        );
        return apiResponse({
          message: `${result.rowCount} tasks archived`,
          archivedCount: result.rowCount,
        });
      }
      case "reorder": {
        if (!Array.isArray(taskUpdates) || taskUpdates.length === 0) {
          return apiError("tasks array is required for reorder");
        }

        const normalizedTaskUpdates = [];
        const seenTaskIds = new Set();

        for (const taskUpdate of taskUpdates) {
          const position = Number(taskUpdate?.position);
          const taskId = optionalUuid(taskUpdate?.id, "Task", { allowNull: false });
          const taskPosition = optionalInteger(position, "Position", { min: 0 });
          const validationError = firstValidationError(taskId, taskPosition);

          if (validationError || !taskId.provided || !taskPosition.provided) {
            return apiError("Each reorder item needs a task id and integer position");
          }
          if (seenTaskIds.has(taskId.value)) {
            return apiError("Duplicate task ids are not allowed for reorder");
          }

          seenTaskIds.add(taskId.value);
          normalizedTaskUpdates.push({ id: taskId.value, position: taskPosition.value });
        }

        await transaction(async (client) => {
          for (const { id, position } of normalizedTaskUpdates) {
            const result = await client.query(
              `UPDATE tasks t SET position = $2
               WHERE t.id = $3 AND ${projectScopedAccessCondition("t")}`,
              [request.user.id, position, id]
            );

            if (result.rowCount !== 1) {
              throw createReorderAccessError();
            }
          }
        });

        return apiResponse({ message: "Tasks reordered" });
      }
    }
  } catch (error) {
    if (error.status) {
      return apiError(error.message, error.status);
    }

    console.error("Bulk action error:", error);
    return apiError("Internal server error", 500);
  }
});
