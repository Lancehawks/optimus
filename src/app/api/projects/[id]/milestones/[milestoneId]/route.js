import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { getProjectForMember } from "@/lib/projectAccess";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id, milestoneId } = await params;
    const body = await request.json();
    const { title, description, dueDate, isCompleted, position } = body;

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    const milestoneAccess = await query(
      "SELECT id, created_by FROM milestones WHERE id = $1 AND project_id = $2",
      [milestoneId, id]
    );
    if (milestoneAccess.rows.length === 0) {
      return apiError("Milestone not found", 404);
    }
    if (milestoneAccess.rows[0].created_by !== request.user.id && project.user_id !== request.user.id) {
      return apiError("Only the milestone creator or project creator can edit this milestone", 403);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (dueDate !== undefined) { fields.push(`due_date = $${paramIndex++}`); values.push(dueDate); }
    if (isCompleted !== undefined) { fields.push(`is_completed = $${paramIndex++}`); values.push(isCompleted); }
    if (position !== undefined) { fields.push(`position = $${paramIndex++}`); values.push(position); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(milestoneId, id);
    const result = await query(
      `UPDATE milestones SET ${fields.join(", ")} WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return apiError("Milestone not found", 404);
    }

    return apiResponse({ milestone: result.rows[0] });
  } catch (error) {
    console.error("Milestone update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id, milestoneId } = await params;

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }
    if (project.user_id !== request.user.id) {
      return apiError("Only the project creator can delete project milestones", 403);
    }

    const result = await query(
      "DELETE FROM milestones WHERE id = $1 AND project_id = $2 RETURNING id",
      [milestoneId, id]
    );

    if (result.rows.length === 0) {
      return apiError("Milestone not found", 404);
    }

    return apiResponse({ message: "Milestone deleted" });
  } catch (error) {
    console.error("Milestone delete error:", error);
    return apiError("Internal server error", 500);
  }
});
