import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { getProjectForMember } from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    const result = await query(
      "SELECT * FROM milestones WHERE project_id = $1 ORDER BY position ASC, due_date ASC NULLS LAST",
      [id]
    );

    return apiResponse({ milestones: result.rows });
  } catch (error) {
    console.error("Milestones list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, dueDate } = body;

    if (!title) {
      return apiError("Title is required");
    }

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    // Get next position
    const posResult = await query(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM milestones WHERE project_id = $1",
      [id]
    );

    const result = await query(
      `INSERT INTO milestones (project_id, created_by, title, description, due_date, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, request.user.id, title, description || null, dueDate || null, posResult.rows[0].next_pos]
    );

    return apiResponse({ milestone: result.rows[0] }, 201);
  } catch (error) {
    console.error("Milestone create error:", error);
    return apiError("Internal server error", 500);
  }
});
