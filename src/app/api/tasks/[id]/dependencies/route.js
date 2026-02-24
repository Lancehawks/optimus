import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    // Verify ownership
    const task = await query("SELECT id FROM tasks WHERE id = $1 AND user_id = $2", [id, request.user.id]);
    if (task.rows.length === 0) return apiError("Task not found", 404);

    const result = await query(
      `SELECT t.id, t.title, t.status, t.priority
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = $1
       ORDER BY t.title`,
      [id]
    );

    return apiResponse({ dependencies: result.rows });
  } catch (error) {
    console.error("Task dependencies get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { dependencies } = await request.json();

    // Verify ownership
    const task = await query("SELECT id FROM tasks WHERE id = $1 AND user_id = $2", [id, request.user.id]);
    if (task.rows.length === 0) return apiError("Task not found", 404);

    // Replace all dependencies
    await query("DELETE FROM task_dependencies WHERE task_id = $1", [id]);

    if (dependencies && dependencies.length > 0) {
      for (const depId of dependencies) {
        if (depId === id) continue; // Can't depend on self
        await query(
          "INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, depId]
        );
      }
    }

    // Return updated dependencies
    const result = await query(
      `SELECT t.id, t.title, t.status, t.priority
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = $1
       ORDER BY t.title`,
      [id]
    );

    return apiResponse({ dependencies: result.rows });
  } catch (error) {
    console.error("Task dependencies update error:", error);
    return apiError("Internal server error", 500);
  }
});
