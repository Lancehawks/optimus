import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    const conditions = ["user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }
    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT * FROM resources
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC`,
      params
    );

    return apiResponse({ resources: result.rows });
  } catch (error) {
    console.error("Resources list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { title, type, fileUrl, notes } = body;

    if (!title) {
      return apiError("Title is required");
    }
    if (!type) {
      return apiError("Type is required");
    }

    const validTypes = ["pdf", "doc", "image", "link", "other"];
    if (!validTypes.includes(type)) {
      return apiError("Invalid resource type");
    }

    const result = await query(
      `INSERT INTO resources (user_id, title, type, file_url, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [request.user.id, title, type, fileUrl || null, notes || null]
    );

    return apiResponse({ resource: result.rows[0] }, 201);
  } catch (error) {
    console.error("Resource create error:", error);
    return apiError("Internal server error", 500);
  }
});
