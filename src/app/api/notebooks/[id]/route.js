import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name) {
      return apiError("Notebook name is required");
    }

    const result = await query(
      `UPDATE notebooks SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [name, id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Notebook not found", 404);
    }

    return apiResponse({ notebook: result.rows[0] });
  } catch (error) {
    console.error("Notebook update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    // Move notes to uncategorized (null notebook_id) before deleting
    await query(
      "UPDATE notes SET notebook_id = NULL WHERE notebook_id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    const result = await query(
      "DELETE FROM notebooks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Notebook not found", 404);
    }

    return apiResponse({ message: "Notebook deleted" });
  } catch (error) {
    console.error("Notebook delete error:", error);
    return apiError("Internal server error", 500);
  }
});
