import { query } from "@/lib/db";
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

    // Move bookmarks to uncategorized (null collection_id) before deleting
    await query(
      "UPDATE bookmarks SET collection_id = NULL WHERE collection_id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    const result = await query(
      "DELETE FROM bookmark_collections WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Collection not found", 404);
    }

    return apiResponse({ message: "Collection deleted" });
  } catch (error) {
    console.error("Bookmark collection delete error:", error);
    return apiError("Internal server error", 500);
  }
});
