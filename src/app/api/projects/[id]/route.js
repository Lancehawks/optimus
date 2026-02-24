import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id)::int AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')::int AS task_done_count
       FROM projects p
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Project not found", 404);
    }

    // Get milestones
    const milestonesResult = await query(
      "SELECT * FROM milestones WHERE project_id = $1 ORDER BY position ASC, due_date ASC NULLS LAST",
      [id]
    );

    // Get tasks
    const tasksResult = await query(
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
       WHERE t.project_id = $1 AND t.user_id = $2 AND t.parent_task_id IS NULL
       GROUP BY t.id
       ORDER BY t.position ASC, t.created_at DESC`,
      [id, request.user.id]
    );

    const project = {
      ...result.rows[0],
      milestones: milestonesResult.rows,
      tasks: tasksResult.rows,
    };

    return apiResponse({ project });
  } catch (error) {
    console.error("Project get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color, status, type, startDate, endDate, isArchived } = body;

    // Verify ownership
    const existing = await query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Project not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(color); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(type); }
    if (startDate !== undefined) { fields.push(`start_date = $${paramIndex++}`); values.push(startDate); }
    if (endDate !== undefined) { fields.push(`end_date = $${paramIndex++}`); values.push(endDate); }
    if (isArchived !== undefined) { fields.push(`is_archived = $${paramIndex++}`); values.push(isArchived); }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await query(
        `UPDATE projects SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id)::int AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')::int AS task_done_count
       FROM projects p
       WHERE p.id = $1`,
      [id]
    );

    return apiResponse({ project: result.rows[0] });
  } catch (error) {
    console.error("Project update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Project not found", 404);
    }

    return apiResponse({ message: "Project deleted" });
  } catch (error) {
    console.error("Project delete error:", error);
    return apiError("Internal server error", 500);
  }
});
