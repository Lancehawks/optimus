import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalBoolean, optionalInteger, optionalString, optionalUuid } from "@/lib/apiValidation";
import { userCanAccessProject } from "@/lib/resourceAccess";
import {
  canDeleteProjectItem,
  canEditProjectItem,
  projectOwnerCondition,
  projectScopedAccessCondition,
} from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT w.*, p.name AS project_name,
        ${projectOwnerCondition("w")} AS is_project_owner
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id
       WHERE ${projectScopedAccessCondition("w")} AND w.id = $2`,
      [request.user.id, id]
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
    const { title, excalidrawData, contentVersion, thumbnailUrl, isTemplate, isPinned, category, projectId } = body;

    const titleResult = optionalString(title, "Title", { max: 255, emptyToNull: false });
    const thumbnailResult = optionalString(thumbnailUrl, "Thumbnail URL", { max: 2048 });
    const templateResult = optionalBoolean(isTemplate, "Template");
    const pinnedResult = optionalBoolean(isPinned, "Pinned");
    const categoryResult = optionalString(category, "Category", { max: 100 });
    const projectResult = optionalUuid(projectId, "Project");
    const contentVersionResult = optionalInteger(contentVersion, "Content version", { min: 1 });
    const validationError = firstValidationError(titleResult, thumbnailResult, templateResult, pinnedResult, categoryResult, projectResult, contentVersionResult);
    if (validationError) return apiError(validationError);
    if (excalidrawData !== undefined && !contentVersionResult.provided) {
      return apiError("Content version is required. Refresh the whiteboard and retry.", 428);
    }
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
      fields.push("content_version = content_version + 1");
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
        `SELECT w.* FROM whiteboards w
         WHERE ${projectScopedAccessCondition("w")} AND w.id = $2
         FOR UPDATE`,
        [request.user.id, id]
      );
      if (existing.rows.length === 0) throw Object.assign(new Error("Whiteboard not found"), { status: 404 });
      if (!(await canEditProjectItem(request.user.id, existing.rows[0], client))) {
        throw Object.assign(new Error("Only the whiteboard creator or project creator can edit this whiteboard"), { status: 403 });
      }
      if (
        excalidrawData !== undefined &&
        Number(existing.rows[0].content_version) !== contentVersionResult.value
      ) {
        throw Object.assign(
          new Error("This whiteboard changed in another tab. Your local draft was preserved; refresh before retrying."),
          { status: 409 }
        );
      }
      if (projectResult.provided && !(await userCanAccessProject(request.user.id, projectResult.value, client))) {
        throw Object.assign(new Error("Project not found"), { status: 400 });
      }
      if (fields.length > 0) {
        fields.push("updated_at = NOW()");
        values.push(id);
        await client.query(
          `UPDATE whiteboards SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
          values
        );
      }
    });

    const result = await query(
      `SELECT w.*, p.name AS project_name,
        ${projectOwnerCondition("w")} AS is_project_owner
       FROM whiteboards w
       LEFT JOIN projects p ON w.project_id = p.id
       WHERE ${projectScopedAccessCondition("w")} AND w.id = $2`,
      [request.user.id, id]
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

    const existing = await query(
      `SELECT w.* FROM whiteboards w
       WHERE ${projectScopedAccessCondition("w")} AND w.id = $2`,
      [request.user.id, id]
    );

    if (existing.rows.length === 0) {
      return apiError("Whiteboard not found", 404);
    }
    if (!(await canDeleteProjectItem(request.user.id, existing.rows[0]))) {
      return apiError("Only the project creator can delete project whiteboards", 403);
    }

    await query("DELETE FROM whiteboards WHERE id = $1", [id]);

    return apiResponse({ message: "Whiteboard deleted" });
  } catch (error) {
    console.error("Whiteboard delete error:", error);
    return apiError("Internal server error", 500);
  }
});
