import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color, position } = body;

    const existing = await query(
      "SELECT id FROM checklist_sections WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Section not found", 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (color !== undefined) {
      fields.push(`color = $${idx++}`);
      values.push(color);
    }
    if (position !== undefined) {
      fields.push(`position = $${idx++}`);
      values.push(position);
    }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    values.push(id);
    const result = await query(
      `UPDATE checklist_sections SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    return apiResponse({ section: result.rows[0] });
  } catch (error) {
    console.error("Checklist section update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM checklist_sections WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );
    if (result.rows.length === 0) {
      return apiError("Section not found", 404);
    }

    return apiResponse({ success: true });
  } catch (error) {
    console.error("Checklist section delete error:", error);
    return apiError("Internal server error", 500);
  }
});
