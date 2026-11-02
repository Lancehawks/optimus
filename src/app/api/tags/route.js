import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      "SELECT * FROM tags WHERE user_id = $1 ORDER BY name ASC",
      [request.user.id]
    );
    return apiResponse({ tags: result.rows });
  } catch (error) {
    console.error("Tags list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { name, color } = await request.json();

    if (!name) {
      return apiError("Tag name is required");
    }

    const result = await query(
      `INSERT INTO tags (user_id, name, color)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
       RETURNING *`,
      [request.user.id, name, color || "#0d6b88"]
    );

    return apiResponse({ tag: result.rows[0] }, 201);
  } catch (error) {
    console.error("Tag create error:", error);
    return apiError("Internal server error", 500);
  }
});
