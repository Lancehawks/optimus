import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT bc.*,
        (SELECT COUNT(*) FROM bookmarks b WHERE b.collection_id = bc.id)::int AS bookmark_count
       FROM bookmark_collections bc
       WHERE bc.user_id = $1
       ORDER BY bc.position ASC, bc.name ASC`,
      [request.user.id]
    );

    return apiResponse({ collections: result.rows });
  } catch (error) {
    console.error("Bookmark collections list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { name, parentId } = await request.json();

    if (!name) {
      return apiError("Collection name is required");
    }

    const posResult = await query(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM bookmark_collections WHERE user_id = $1",
      [request.user.id]
    );

    const result = await query(
      `INSERT INTO bookmark_collections (user_id, name, parent_id, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.user.id, name, parentId || null, posResult.rows[0].next_pos]
    );

    return apiResponse({ collection: { ...result.rows[0], bookmark_count: 0 } }, 201);
  } catch (error) {
    console.error("Bookmark collection create error:", error);
    return apiError("Internal server error", 500);
  }
});
