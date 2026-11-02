import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name) {
      return apiError("Collection name is required");
    }

    const result = await query(
      `UPDATE bookmark_collections SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name, id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Collection not found", 404);
    }

    return apiResponse({ collection: result.rows[0] });
  } catch (error) {
    console.error("Bookmark collection update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await transaction(async (client) => {
      const deleted = await client.query(
        "DELETE FROM bookmark_collections WHERE id = $1 AND user_id = $2 RETURNING id",
        [id, request.user.id]
      );
      // ON DELETE SET NULL handles bookmarks and child collections atomically.
      return deleted;
    });

    if (result.rows.length === 0) {
      return apiError("Collection not found", 404);
    }

    return apiResponse({ message: "Collection deleted" });
  } catch (error) {
    console.error("Bookmark collection delete error:", error);
    return apiError("Internal server error", 500);
  }
});
