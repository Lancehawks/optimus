import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request) => {
  try {
    const { action, taskIds } = await request.json();

    if (!taskIds || taskIds.length === 0) {
      return apiError("Task IDs are required");
    }

    // Generate placeholders for user_id check
    const placeholders = taskIds.map((_, i) => `$${i + 2}`).join(", ");

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
        const { status } = await request.json();
        await query(
          `UPDATE tasks SET status = $${taskIds.length + 2} WHERE id IN (${placeholders}) AND user_id = $1`,
          [request.user.id, ...taskIds, status]
        );
        return apiResponse({ message: `${taskIds.length} tasks updated` });
      }
      default:
        return apiError("Invalid action");
    }
  } catch (error) {
    console.error("Bulk action error:", error);
    return apiError("Internal server error", 500);
  }
});
