import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { validateProjectUpdateBody } from "@/lib/projectValidation";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Project", { allowNull: false }).error) {
      return apiError("Project ID is invalid");
    }

    const result = await query(
      `SELECT p.*,
        (p.user_id = $2) AS is_owner,
        (SELECT COUNT(*) FROM project_members pm_count WHERE pm_count.project_id = p.id)::int AS member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id)::int AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')::int AS task_done_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE p.id = $1 AND pm.user_id = $2`,
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
       WHERE t.project_id = $1 AND t.parent_task_id IS NULL
       GROUP BY t.id
       ORDER BY t.position ASC, t.created_at DESC`,
      [id]
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
    if (optionalUuid(id, "Project", { allowNull: false }).error) {
      return apiError("Project ID is invalid");
    }

    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateProjectUpdateBody(body);
    if (validation.error) return apiError(validation.error);
    const updates = validation.value;

    // Project-level metadata belongs to the project creator. Members manage
    // only the individual items they create inside the project.
    const existing = await query(
      `SELECT p.id
       FROM projects p
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Only the project creator can update project settings", 403);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(updates.description); }
    if (updates.color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(updates.color); }
    if (updates.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(updates.status); }
    if (updates.type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(updates.type); }
    if (updates.startDate !== undefined) { fields.push(`start_date = $${paramIndex++}`); values.push(updates.startDate); }
    if (updates.endDate !== undefined) { fields.push(`end_date = $${paramIndex++}`); values.push(updates.endDate); }
    if (updates.isArchived !== undefined) { fields.push(`is_archived = $${paramIndex++}`); values.push(updates.isArchived); }

    const project = await transaction(async (client) => {
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(id);
        await client.query(
          `UPDATE projects SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
          values
        );
      }

      const result = await client.query(
        `SELECT p.*,
          (p.user_id = $2) AS is_owner,
          (SELECT COUNT(*) FROM project_members pm_count WHERE pm_count.project_id = p.id)::int AS member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id)::int AS task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')::int AS task_done_count
         FROM projects p
         WHERE p.id = $1`,
        [id, request.user.id]
      );

      await recordProjectActivity({
        projectId: id,
        actorUserId: request.user.id,
        action: "updated",
        entityType: "project",
        entityId: id,
        entityTitle: result.rows[0]?.name,
        db: client,
        strict: true,
      });

      return result.rows[0];
    });

    return apiResponse({ project });
  } catch (error) {
    console.error("Project update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Project", { allowNull: false }).error) {
      return apiError("Project ID is invalid");
    }

    const { searchParams } = new URL(request.url);
    const deleteTasks = searchParams.get("deleteTasks") === "true";

    // Project deletion is limited to its creator.
    const existing = await query(
      "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Project not found", 404);
    }

    await transaction(async (client) => {
      if (deleteTasks) {
        await client.query("DELETE FROM tasks WHERE project_id = $1", [id]);
      }

      await client.query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [id, request.user.id]);
    });

    return apiResponse({ message: "Project deleted" });
  } catch (error) {
    console.error("Project delete error:", error);
    return apiError("Internal server error", 500);
  }
});
