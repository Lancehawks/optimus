import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, start_time, end_time, color, position } = body;

    const existing = await query(
      "SELECT id FROM day_plan_blocks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Block not found", 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title.trim()); }
    if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(start_time); }
    if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(end_time); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (position !== undefined) { fields.push(`position = $${idx++}`); values.push(position); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    values.push(id);
    const result = await query(
      `UPDATE day_plan_blocks SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    return apiResponse({ block: result.rows[0] });
  } catch (error) {
    console.error("Day plan block update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM day_plan_blocks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );
    if (result.rows.length === 0) {
      return apiError("Block not found", 404);
    }

    return apiResponse({ success: true });
  } catch (error) {
    console.error("Day plan block delete error:", error);
    return apiError("Internal server error", 500);
  }
});
