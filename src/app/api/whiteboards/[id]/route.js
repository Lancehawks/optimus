import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT w.*, p.name AS project_name
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id
       WHERE w.id = $1 AND w.user_id = $2`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Whiteboard not found", 404);
    }

    return apiResponse({ whiteboard: result.rows[0] });
  } catch (error) {
    console.error("Whiteboard get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, excalidrawData, thumbnailUrl, isTemplate, isPinned, category, projectId } = body;

    // Verify ownership
    const existing = await query(
      "SELECT id FROM whiteboards WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Whiteboard not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (excalidrawData !== undefined) {
      fields.push(`excalidraw_data = $${paramIndex++}`);
      values.push(JSON.stringify(excalidrawData));
    }
    if (thumbnailUrl !== undefined) {
      fields.push(`thumbnail_url = $${paramIndex++}`);
      values.push(thumbnailUrl);
    }
    if (isTemplate !== undefined) {
      fields.push(`is_template = $${paramIndex++}`);
      values.push(isTemplate);
    }
    if (isPinned !== undefined) {
      fields.push(`is_pinned = $${paramIndex++}`);
      values.push(isPinned);
    }
    if (category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (projectId !== undefined) {
      fields.push(`project_id = $${paramIndex++}`);
      values.push(projectId || null);
    }

    if (fields.length > 0) {
      values.push(id);
      await query(
        `UPDATE whiteboards SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    const result = await query(
      `SELECT w.*, p.name AS project_name
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id
       WHERE w.id = $1`,
      [id]
    );
    return apiResponse({ whiteboard: result.rows[0] });
  } catch (error) {
    console.error("Whiteboard update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM whiteboards WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Whiteboard not found", 404);
    }

    return apiResponse({ message: "Whiteboard deleted" });
  } catch (error) {
    console.error("Whiteboard delete error:", error);
    return apiError("Internal server error", 500);
  }
});
