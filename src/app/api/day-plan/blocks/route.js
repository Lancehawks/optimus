import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT * FROM day_plan_blocks
       WHERE user_id = $1
       ORDER BY position ASC, start_time ASC`,
      [request.user.id]
    );

    return apiResponse({ blocks: result.rows });
  } catch (error) {
    console.error("Day plan blocks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { title, start_time, end_time, color } = body;

    if (!title || !title.trim()) {
      return apiError("Title is required");
    }
    if (!start_time || !end_time) {
      return apiError("Start and end times are required");
    }

    const posResult = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM day_plan_blocks WHERE user_id = $1",
      [request.user.id]
    );

    const result = await query(
      `INSERT INTO day_plan_blocks (user_id, title, start_time, end_time, color, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [request.user.id, title.trim(), start_time, end_time, color || "#14b8a6", posResult.rows[0].next_pos]
    );

    return apiResponse({ block: result.rows[0] }, 201);
  } catch (error) {
    console.error("Day plan block create error:", error);
    return apiError("Internal server error", 500);
  }
});
