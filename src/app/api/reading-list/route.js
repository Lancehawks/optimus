import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("project_id");

    const conditions = ["rl.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`rl.status = $${paramIndex++}`);
      params.push(status);
    }
    if (projectId) {
      conditions.push(`rl.project_id = $${paramIndex++}`);
      params.push(projectId);
    }

    const result = await query(
      `SELECT rl.*, p.name AS project_name, p.color AS project_color
       FROM reading_list rl
       LEFT JOIN projects p ON p.id = rl.project_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY rl.created_at DESC`,
      params
    );

    return apiResponse({ items: result.rows });
  } catch (error) {
    console.error("Reading list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { title, url, resourceId, projectId } = body;

    if (!title) {
      return apiError("Title is required");
    }

    const result = await query(
      `INSERT INTO reading_list (user_id, title, url, resource_id, project_id, status, progress)
       VALUES ($1, $2, $3, $4, $5, 'unread', 0)
       RETURNING *`,
      [request.user.id, title, url || null, resourceId || null, projectId || null]
    );

    return apiResponse({ item: result.rows[0] }, 201);
  } catch (error) {
    console.error("Reading list create error:", error);
    return apiError("Internal server error", 500);
  }
});
