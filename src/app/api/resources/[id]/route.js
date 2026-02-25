import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "SELECT * FROM resources WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Resource not found", 404);
    }

    return apiResponse({ resource: result.rows[0] });
  } catch (error) {
    console.error("Resource get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, type, fileUrl, notes } = body;

    const existing = await query(
      "SELECT id FROM resources WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Resource not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(type); }
    if (fileUrl !== undefined) { fields.push(`file_url = $${paramIndex++}`); values.push(fileUrl); }
    if (notes !== undefined) { fields.push(`notes = $${paramIndex++}`); values.push(notes); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE resources SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return apiResponse({ resource: result.rows[0] });
  } catch (error) {
    console.error("Resource update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM resources WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Resource not found", 404);
    }

    return apiResponse({ message: "Resource deleted" });
  } catch (error) {
    console.error("Resource delete error:", error);
    return apiError("Internal server error", 500);
  }
});
