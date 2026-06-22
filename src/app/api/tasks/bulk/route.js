import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { projectScopedAccessCondition } from "@/lib/projectAccess";

export const POST = withAuth(async (request) => {
  try {
    // Read body once — avoids the double-read bug in update_status
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
             AND t.user_id = $1
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
        await query(
          `UPDATE tasks t SET is_archived = true
           WHERE id IN (${placeholders}) AND ${projectScopedAccessCondition("t")}`,
          [request.user.id, ...taskIds]
        );
        return apiResponse({ message: `${taskIds.length} tasks archived` });
      }
      case "reorder": {
        if (!taskUpdates || taskUpdates.length === 0) {
          return apiError("tasks array is required for reorder");
        }
        await query("BEGIN");
        for (const { id, position } of taskUpdates) {
          await query(
            `UPDATE tasks t SET position = $2
             WHERE t.id = $3 AND ${projectScopedAccessCondition("t")}`,
            [request.user.id, position, id]
          );
        }
        await query("COMMIT");
        return apiResponse({ message: "Tasks reordered" });
      }
      default:
        return apiError("Invalid action");
    }
  } catch (error) {
    console.error("Bulk action error:", error);
    return apiError("Internal server error", 500);
  }
});
