import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id: sectionId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return apiError("Name is required");
    }

    // Verify section ownership
    const section = await query(
      "SELECT id FROM checklist_sections WHERE id = $1 AND user_id = $2",
      [sectionId, request.user.id]
    );
    if (section.rows.length === 0) {
      return apiError("Section not found", 404);
    }

    // Get next position
    const posResult = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM checklist_items WHERE section_id = $1",
      [sectionId]
    );

    const result = await query(
      `INSERT INTO checklist_items (section_id, name, position)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sectionId, name.trim(), posResult.rows[0].next_pos]
    );

    return apiResponse({ item: result.rows[0] }, 201);
  } catch (error) {
    console.error("Checklist item create error:", error);
    return apiError("Internal server error", 500);
  }
});
