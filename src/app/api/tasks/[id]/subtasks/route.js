import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { isProjectOwner, projectScopedAccessCondition } from "@/lib/projectAccess";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { title } = await request.json();

    if (!title) {
      return apiError("Title is required");
    }

    // Verify access to the parent task.
    const parent = await query(
      `SELECT t.id, t.project_id
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (parent.rows.length === 0) {
      return apiError("Task not found", 404);
    }
    const parentTask = parent.rows[0];

    // Get max position for subtasks
    const posResult = await query(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE parent_task_id = $1",
      [id]
    );

    const result = await query(
      `INSERT INTO tasks (user_id, parent_task_id, title, status, position, project_id)
       VALUES ($1, $2, $3, 'todo', $4, $5)
       RETURNING *`,
      [request.user.id, id, title, posResult.rows[0].next_pos, parentTask.project_id]
    );

    return apiResponse({ subtask: result.rows[0] }, 201);
  } catch (error) {
    console.error("Subtask create error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { subtaskId, title, status } = await request.json();

    if (!subtaskId) {
      return apiError("Subtask ID is required");
    }

    const parent = await query(
      `SELECT t.id
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (parent.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    const subtask = await query(
      "SELECT id FROM tasks WHERE id = $1 AND parent_task_id = $2",
      [subtaskId, id]
    );
    if (subtask.rows.length === 0) {
      return apiError("Subtask not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }

    if (fields.length > 0) {
      values.push(subtaskId);
      const result = await query(
        `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return apiResponse({ subtask: result.rows[0] });
    }

    return apiResponse({ subtask: subtask.rows[0] });
  } catch (error) {
    console.error("Subtask update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { subtaskId } = await request.json();

    if (!subtaskId) {
      return apiError("Subtask ID is required");
    }

    const parent = await query(
      `SELECT t.id, t.project_id
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (parent.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    const subtask = await query(
      "SELECT id, user_id FROM tasks WHERE id = $1 AND parent_task_id = $2",
      [subtaskId, id]
    );

    if (subtask.rows.length === 0) {
      return apiError("Subtask not found", 404);
    }

    const parentTask = parent.rows[0];
    const isCreator = subtask.rows[0].user_id === request.user.id;
    const isOwner = parentTask.project_id && (await isProjectOwner(request.user.id, parentTask.project_id));

    if (!isCreator && !isOwner) {
      return apiError("Only the subtask creator or project owner can delete this subtask", 403);
    }

    await query(
      "DELETE FROM tasks WHERE id = $1 AND parent_task_id = $2",
      [subtaskId, id]
    );

    return apiResponse({ message: "Subtask deleted" });
  } catch (error) {
    console.error("Subtask delete error:", error);
    return apiError("Internal server error", 500);
  }
});
