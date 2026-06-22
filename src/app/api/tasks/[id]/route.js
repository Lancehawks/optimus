import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember, projectScopedAccessCondition } from "@/lib/projectAccess";

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
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2
       GROUP BY t.id`,
      [request.user.id, id]
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
       WHERE ${projectScopedAccessCondition("t")} AND td.task_id = $2`,
      [request.user.id, id]
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
    const { title, description, status, priority, dueDate, projectId, position, tags, recurrenceRule, dependencies, deferred, isArchived } = body;

    // Verify personal ownership or shared project membership.
    const existing = await query(
      `SELECT t.*
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (existing.rows.length === 0) {
      return apiError("Task not found", 404);
    }
    const currentTask = existing.rows[0];
    const effectiveProjectId = projectId !== undefined ? projectId || null : currentTask.project_id;

    if (projectId !== undefined) {
      if (effectiveProjectId) {
        const project = await getProjectForMember(request.user.id, effectiveProjectId);
        if (!project) {
          return apiError("Project not found", 404);
        }
      } else if (currentTask.user_id !== request.user.id) {
        return apiError("Only the task creator can move it back to personal tasks", 403);
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(priority); }
    if (dueDate !== undefined) { fields.push(`due_date = $${paramIndex++}`); values.push(dueDate); }
    if (projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(projectId || null); }
    if (position !== undefined) { fields.push(`position = $${paramIndex++}`); values.push(position); }
    if (recurrenceRule !== undefined) { fields.push(`recurrence_rule = $${paramIndex++}`); values.push(recurrenceRule || null); }
    if (deferred !== undefined) { fields.push(`deferred = $${paramIndex++}`); values.push(deferred); }
    if (isArchived !== undefined) { fields.push(`is_archived = $${paramIndex++}`); values.push(isArchived); }

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
      const updatedTask = taskResult.rows[0];
      if (updatedTask && updatedTask.recurrence_rule) {
        const rule = updatedTask.recurrence_rule;
        let nextDueDate = null;

        if (updatedTask.due_date) {
          const d = new Date(updatedTask.due_date);
          if (rule === "daily") d.setDate(d.getDate() + 1);
          else if (rule === "weekly") d.setDate(d.getDate() + 7);
          else if (rule === "monthly") d.setMonth(d.getMonth() + 1);
          nextDueDate = d.toISOString();
        }

        // Get next position
        const posRes = updatedTask.project_id
          ? await query(
              "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE project_id = $1 AND parent_task_id IS NULL",
              [updatedTask.project_id]
            )
          : await query(
              "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = $1 AND project_id IS NULL AND parent_task_id IS NULL",
              [updatedTask.user_id]
            );

        await query(
          `INSERT INTO tasks (user_id, title, description, priority, due_date, project_id, recurrence_rule, position, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'todo')`,
          [
            updatedTask.user_id,
            updatedTask.title,
            updatedTask.description,
            updatedTask.priority,
            nextDueDate,
            updatedTask.project_id,
            updatedTask.recurrence_rule,
            posRes.rows[0].next_pos,
          ]
        );
      }
    }

    // Update dependencies if provided
    if (dependencies !== undefined) {
      const normalizedDeps = [...new Set((dependencies || []).filter((depId) => depId !== id))];
      if (normalizedDeps.length > 0) {
        const dependencyParams = [request.user.id, normalizedDeps];
        let dependencyProjectClause = "";

        if (effectiveProjectId) {
          dependencyProjectClause = "AND t.project_id = $3";
          dependencyParams.push(effectiveProjectId);
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

      await query("DELETE FROM task_dependencies WHERE task_id = $1", [id]);
      for (const depId of normalizedDeps) {
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
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2
       GROUP BY t.id`,
      [request.user.id, id]
    );

    const updatedTask = result.rows[0];
    if (projectId !== undefined && currentTask.project_id && !effectiveProjectId) {
      await recordProjectActivity({
        projectId: currentTask.project_id,
        actorUserId: request.user.id,
        action: "moved_to_personal",
        entityType: "task",
        entityId: currentTask.id,
        entityTitle: currentTask.title,
      });
    } else if (effectiveProjectId) {
      await recordProjectActivity({
        projectId: effectiveProjectId,
        actorUserId: request.user.id,
        action: projectId !== undefined && currentTask.project_id !== effectiveProjectId
          ? "moved_to_project"
          : status === "done" && currentTask.status !== "done"
            ? "completed"
            : "updated",
        entityType: "task",
        entityId: updatedTask.id,
        entityTitle: updatedTask.title,
      });
    }

    return apiResponse({ task: result.rows[0] });
  } catch (error) {
    console.error("Task update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const existing = await query(
      `SELECT t.id, t.user_id, t.project_id, t.title
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );

    if (existing.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    if (existing.rows[0].user_id !== request.user.id) {
      return apiError("Only the task creator can delete this task", 403);
    }

    const task = existing.rows[0];

    await query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (task.project_id) {
      await recordProjectActivity({
        projectId: task.project_id,
        actorUserId: request.user.id,
        action: "deleted",
        entityType: "task",
        entityId: task.id,
        entityTitle: task.title,
      });
    }

    return apiResponse({ message: "Task deleted" });
  } catch (error) {
    console.error("Task delete error:", error);
    return apiError("Internal server error", 500);
  }
});
