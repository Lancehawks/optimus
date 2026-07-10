import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { creatorOrProjectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";

function createReorderAccessError() {
  const error = new Error("One or more tasks could not be reordered");
  error.status = 403;
  return error;
}

export const POST = withAuth(async (request) => {
  try {
    // Read body once to avoid the double-read bug in update_status.
    const body = await request.json();
    const { action, taskIds, tasks: taskUpdates } = body;

    // reorder uses taskUpdates, not taskIds
    if (action !== "reorder" && (!taskIds || taskIds.length === 0)) {
      return apiError("Task IDs are required");
    }

    const placeholders = taskIds ? taskIds.map((_, i) => `$${i + 2}`).join(", ") : "";

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
        const { status } = body;
        await query(
          `UPDATE tasks t SET status = $${taskIds.length + 2}
           WHERE id IN (${placeholders}) AND ${projectScopedAccessCondition("t")}`,
          [request.user.id, ...taskIds, status]
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

          if (!taskUpdate?.id || !Number.isInteger(position)) {
            return apiError("Each reorder item needs a task id and integer position");
          }
          if (seenTaskIds.has(taskUpdate.id)) {
            return apiError("Duplicate task ids are not allowed for reorder");
          }

          seenTaskIds.add(taskUpdate.id);
          normalizedTaskUpdates.push({ id: taskUpdate.id, position });
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
      default:
        return apiError("Invalid action");
    }
  } catch (error) {
    if (error.status) {
      return apiError(error.message, error.status);
    }

    console.error("Bulk action error:", error);
    return apiError("Internal server error", 500);
  }
});
