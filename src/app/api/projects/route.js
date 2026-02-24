import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const includeArchived = searchParams.get("include_archived") === "true";

    const conditions = ["p.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`p.status = $${paramIndex++}`);
      params.push(status);
    }
    if (!includeArchived) {
      conditions.push("p.is_archived = false");
    }

    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id)::int AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')::int AS task_done_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id)::int AS milestone_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.is_completed = true)::int AS milestone_done_count
       FROM projects p
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.created_at DESC`,
      params
    );

    return apiResponse({ projects: result.rows });
  } catch (error) {
    console.error("Projects list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { name, description, color, status, type, startDate, endDate } = body;

    if (!name) {
      return apiError("Name is required");
    }

    const result = await query(
      `INSERT INTO projects (user_id, name, description, color, status, type, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.user.id,
        name,
        description || null,
        color || "#6366f1",
        status || "active",
        type || null,
        startDate || null,
        endDate || null,
      ]
    );

    return apiResponse({ project: result.rows[0] }, 201);
  } catch (error) {
    console.error("Project create error:", error);
    return apiError("Internal server error", 500);
  }
});
