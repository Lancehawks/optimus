import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

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
          `UPDATE tasks SET status = 'done' WHERE id IN (${placeholders}) AND user_id = $1`,
          [request.user.id, ...taskIds]
        );
        return apiResponse({ message: `${taskIds.length} tasks completed` });
      }
      case "delete": {
        await query(
          `DELETE FROM tasks WHERE id IN (${placeholders}) AND user_id = $1`,
          [request.user.id, ...taskIds]
        );
        return apiResponse({ message: `${taskIds.length} tasks deleted` });
      }
      case "update_status": {
        const { status } = body;
        await query(
          `UPDATE tasks SET status = $${taskIds.length + 2} WHERE id IN (${placeholders}) AND user_id = $1`,
          [request.user.id, ...taskIds, status]
        );
        return apiResponse({ message: `${taskIds.length} tasks updated` });
      }
      case "archive": {
        await query(
          `UPDATE tasks SET is_archived = true WHERE id IN (${placeholders}) AND user_id = $1`,
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
            "UPDATE tasks SET position = $1 WHERE id = $2 AND user_id = $3",
            [position, id, request.user.id]
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
