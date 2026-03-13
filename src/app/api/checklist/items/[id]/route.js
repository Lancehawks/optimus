import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, position } = body;

    // Verify ownership through section
    const existing = await query(
      `SELECT ci.id FROM checklist_items ci
       JOIN checklist_sections cs ON cs.id = ci.section_id
       WHERE ci.id = $1 AND cs.user_id = $2`,
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Item not found", 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name.trim());
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
      `UPDATE checklist_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    return apiResponse({ item: result.rows[0] });
  } catch (error) {
    console.error("Checklist item update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    // Verify ownership through section
    const result = await query(
      `DELETE FROM checklist_items ci
       USING checklist_sections cs
       WHERE ci.section_id = cs.id AND ci.id = $1 AND cs.user_id = $2
       RETURNING ci.id`,
      [id, request.user.id]
    );
    if (result.rows.length === 0) {
      return apiError("Item not found", 404);
    }

    return apiResponse({ success: true });
  } catch (error) {
    console.error("Checklist item delete error:", error);
    return apiError("Internal server error", 500);
  }
});
