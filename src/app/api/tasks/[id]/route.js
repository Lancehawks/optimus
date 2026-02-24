import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM tasks t
       LEFT JOIN task_tags tt ON tt.task_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    // Get subtasks
    const subtasksResult = await query(
      "SELECT * FROM tasks WHERE parent_task_id = $1 ORDER BY position ASC, created_at ASC",
      [id]
    );

    const task = { ...result.rows[0], subtasks: subtasksResult.rows };
    return apiResponse({ task });
  } catch (error) {
    console.error("Task get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, status, priority, dueDate, projectId, position, tags } = body;

    // Verify ownership
    const existing = await query(
      "SELECT id FROM tasks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(priority); }
    if (dueDate !== undefined) { fields.push(`due_date = $${paramIndex++}`); values.push(dueDate); }
    if (projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(projectId); }
    if (position !== undefined) { fields.push(`position = $${paramIndex++}`); values.push(position); }

    if (fields.length > 0) {
      values.push(id);
      await query(
        `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Update tags if provided
    if (tags !== undefined) {
      await query("DELETE FROM task_tags WHERE task_id = $1", [id]);
      for (const tagId of tags) {
        await query(
          "INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, tagId]
        );
      }
    }

    // Return updated task
    const result = await query(
      `SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM tasks t
       LEFT JOIN task_tags tt ON tt.task_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       WHERE t.id = $1
       GROUP BY t.id`,
      [id]
    );

    return apiResponse({ task: result.rows[0] });
  } catch (error) {
    console.error("Task update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    return apiResponse({ message: "Task deleted" });
  } catch (error) {
    console.error("Task delete error:", error);
    return apiError("Internal server error", 500);
  }
});
