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

    // Get dependencies (tasks this task depends on)
    const depsResult = await query(
      `SELECT t.id, t.title, t.status FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = $1`,
      [id]
    );

    const task = { ...result.rows[0], subtasks: subtasksResult.rows, dependencies: depsResult.rows };
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
    const { title, description, status, priority, dueDate, projectId, position, tags, recurrenceRule, dependencies, deferred } = body;

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
    if (recurrenceRule !== undefined) { fields.push(`recurrence_rule = $${paramIndex++}`); values.push(recurrenceRule || null); }
    if (deferred !== undefined) { fields.push(`deferred = $${paramIndex++}`); values.push(deferred); }

    if (fields.length > 0) {
      values.push(id);
      await query(
        `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Handle recurrence: when a recurring task is marked done, create next occurrence
    if (status === "done") {
      const taskResult = await query("SELECT * FROM tasks WHERE id = $1", [id]);
      const currentTask = taskResult.rows[0];
      if (currentTask && currentTask.recurrence_rule) {
        const rule = currentTask.recurrence_rule;
        let nextDueDate = null;

        if (currentTask.due_date) {
          const d = new Date(currentTask.due_date);
          if (rule === "daily") d.setDate(d.getDate() + 1);
          else if (rule === "weekly") d.setDate(d.getDate() + 7);
          else if (rule === "monthly") d.setMonth(d.getMonth() + 1);
          nextDueDate = d.toISOString();
        }

        // Get next position
        const posRes = await query(
          "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = $1 AND parent_task_id IS NULL",
          [request.user.id]
        );

        await query(
          `INSERT INTO tasks (user_id, title, description, priority, due_date, project_id, recurrence_rule, position, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'todo')`,
          [
            request.user.id,
            currentTask.title,
            currentTask.description,
            currentTask.priority,
            nextDueDate,
            currentTask.project_id,
            currentTask.recurrence_rule,
            posRes.rows[0].next_pos,
          ]
        );
      }
    }

    // Update dependencies if provided
    if (dependencies !== undefined) {
      await query("DELETE FROM task_dependencies WHERE task_id = $1", [id]);
      for (const depId of dependencies) {
        await query(
          "INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, depId]
        );
      }
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
