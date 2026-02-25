import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    // Get the original whiteboard with full data
    const original = await query(
      "SELECT * FROM whiteboards WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (original.rows.length === 0) {
      return apiError("Whiteboard not found", 404);
    }

    const wb = original.rows[0];

    const result = await query(
      `INSERT INTO whiteboards (user_id, title, excalidraw_data, category, project_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        request.user.id,
        `${wb.title} (Copy)`,
        JSON.stringify(wb.excalidraw_data),
        wb.category,
        wb.project_id,
      ]
    );

    return apiResponse({ whiteboard: result.rows[0] }, 201);
  } catch (error) {
    console.error("Whiteboard duplicate error:", error);
    return apiError("Internal server error", 500);
  }
});
