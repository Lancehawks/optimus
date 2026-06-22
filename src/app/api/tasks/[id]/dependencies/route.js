import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { projectScopedAccessCondition } from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const task = await query(
      `SELECT t.id
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (task.rows.length === 0) return apiError("Task not found", 404);

    const result = await query(
      `SELECT t.id, t.title, t.status, t.priority
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE ${projectScopedAccessCondition("t")} AND td.task_id = $2
       ORDER BY t.title`,
      [request.user.id, id]
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

    const task = await query(
      `SELECT t.id, t.project_id
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (task.rows.length === 0) return apiError("Task not found", 404);
    const currentTask = task.rows[0];

    const normalizedDeps = [...new Set((dependencies || []).filter((depId) => depId !== id))];
    if (normalizedDeps.length > 0) {
      const dependencyParams = [request.user.id, normalizedDeps];
      let dependencyProjectClause = "";

      if (currentTask.project_id) {
        dependencyProjectClause = "AND t.project_id = $3";
        dependencyParams.push(currentTask.project_id);
      }

      const dependencyAccess = await query(
        `SELECT COUNT(DISTINCT t.id)::int AS count
         FROM tasks t
         WHERE ${projectScopedAccessCondition("t")}
           AND t.id = ANY($2::uuid[])
           ${dependencyProjectClause}`,
        dependencyParams
      );

      if ((dependencyAccess.rows[0]?.count || 0) !== normalizedDeps.length) {
        return apiError("One or more dependencies are not available to this task", 403);
      }
    }

    // Replace all dependencies
    await query("DELETE FROM task_dependencies WHERE task_id = $1", [id]);

    if (normalizedDeps.length > 0) {
      for (const depId of normalizedDeps) {
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
       WHERE ${projectScopedAccessCondition("t")} AND td.task_id = $2
       ORDER BY t.title`,
      [request.user.id, id]
    );

    return apiResponse({ dependencies: result.rows });
  } catch (error) {
    console.error("Task dependencies update error:", error);
    return apiError("Internal server error", 500);
  }
});
