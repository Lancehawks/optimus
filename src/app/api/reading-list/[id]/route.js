import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, url, status, progress, resourceId } = body;

    const existing = await query(
      "SELECT id FROM reading_list WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Item not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (url !== undefined) { fields.push(`url = $${paramIndex++}`); values.push(url); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }
    if (progress !== undefined) { fields.push(`progress = $${paramIndex++}`); values.push(progress); }
    if (resourceId !== undefined) { fields.push(`resource_id = $${paramIndex++}`); values.push(resourceId); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE reading_list SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return apiResponse({ item: result.rows[0] });
  } catch (error) {
    console.error("Reading list update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM reading_list WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Item not found", 404);
    }

    return apiResponse({ message: "Item deleted" });
  } catch (error) {
    console.error("Reading list delete error:", error);
    return apiError("Internal server error", 500);
  }
});
