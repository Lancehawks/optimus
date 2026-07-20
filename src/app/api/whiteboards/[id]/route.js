import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalBoolean, optionalString, optionalUuid } from "@/lib/apiValidation";
import { userCanAccessProject } from "@/lib/resourceAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT w.*, p.name AS project_name
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id AND (
         p.user_id = $2 OR EXISTS (
           SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2
         )
       )
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

    const titleResult = optionalString(title, "Title", { max: 255, emptyToNull: false });
    const thumbnailResult = optionalString(thumbnailUrl, "Thumbnail URL", { max: 2048 });
    const templateResult = optionalBoolean(isTemplate, "Template");
    const pinnedResult = optionalBoolean(isPinned, "Pinned");
    const categoryResult = optionalString(category, "Category", { max: 100 });
    const projectResult = optionalUuid(projectId, "Project");
    const validationError = firstValidationError(titleResult, thumbnailResult, templateResult, pinnedResult, categoryResult, projectResult);
    if (validationError) return apiError(validationError);
    let serializedData;
    if (excalidrawData !== undefined) {
      serializedData = JSON.stringify(excalidrawData);
      if (serializedData.length > 2_000_000) return apiError("Whiteboard data is too large", 413);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(titleResult.value);
    }
    if (excalidrawData !== undefined) {
      fields.push(`excalidraw_data = $${paramIndex++}`);
      values.push(serializedData);
    }
    if (thumbnailUrl !== undefined) {
      fields.push(`thumbnail_url = $${paramIndex++}`);
      values.push(thumbnailResult.value);
    }
    if (isTemplate !== undefined) {
      fields.push(`is_template = $${paramIndex++}`);
      values.push(templateResult.value);
    }
    if (isPinned !== undefined) {
      fields.push(`is_pinned = $${paramIndex++}`);
      values.push(pinnedResult.value);
    }
    if (category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(categoryResult.value);
    }
    if (projectId !== undefined) {
      fields.push(`project_id = $${paramIndex++}`);
      values.push(projectResult.value || null);
    }

    await transaction(async (client) => {
      const existing = await client.query(
        "SELECT id FROM whiteboards WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, request.user.id]
      );
      if (existing.rows.length === 0) throw Object.assign(new Error("Whiteboard not found"), { status: 404 });
      if (projectResult.provided && !(await userCanAccessProject(request.user.id, projectResult.value, client))) {
        throw Object.assign(new Error("Project not found"), { status: 400 });
      }
      if (fields.length > 0) {
        fields.push("updated_at = NOW()");
        values.push(id, request.user.id);
        await client.query(
          `UPDATE whiteboards SET ${fields.join(", ")} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
          values
        );
      }
    });

    const result = await query(
      `SELECT w.*, p.name AS project_name
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id AND (
         p.user_id = $2 OR EXISTS (
           SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2
         )
       )
       WHERE w.id = $1 AND w.user_id = $2`,
      [id, request.user.id]
    );
    return apiResponse({ whiteboard: result.rows[0] });
  } catch (error) {
    if (error.status) return apiError(error.message, error.status);
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
