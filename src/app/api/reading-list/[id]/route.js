import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalEnum, optionalInteger, optionalString, optionalUuid } from "@/lib/apiValidation";
import { userCanAccessProject, userOwnsResource } from "@/lib/resourceAccess";
import { normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";
import { canDeleteProjectItem, canEditProjectItem, projectScopedAccessCondition } from "@/lib/projectAccess";

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, url, status, progress, resourceId, projectId } = body;

    const titleResult = optionalString(title, "Title", { max: 255, emptyToNull: false });
    const urlResult = optionalString(url, "URL", { max: 2048 });
    const statusResult = optionalEnum(status, "Status", ["unread", "reading", "completed"]);
    const progressResult = optionalInteger(progress, "Progress", { min: 0, max: 100 });
    const resourceResult = optionalUuid(resourceId, "Resource");
    const projectResult = optionalUuid(projectId, "Project");
    const validationError = firstValidationError(titleResult, urlResult, statusResult, progressResult, resourceResult, projectResult);
    if (validationError) return apiError(validationError);
    let normalizedUrl = urlResult.value;
    if (urlResult.provided && normalizedUrl) {
      try { normalizedUrl = normalizePublicHttpUrl(normalizedUrl).toString(); }
      catch (error) { return apiError(error.message); }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (titleResult.provided) { fields.push(`title = $${paramIndex++}`); values.push(titleResult.value); }
    if (urlResult.provided) { fields.push(`url = $${paramIndex++}`); values.push(normalizedUrl); }
    if (statusResult.provided) { fields.push(`status = $${paramIndex++}`); values.push(statusResult.value); }
    if (progressResult.provided) { fields.push(`progress = $${paramIndex++}`); values.push(progressResult.value); }
    if (resourceResult.provided) { fields.push(`resource_id = $${paramIndex++}`); values.push(resourceResult.value); }
    if (projectResult.provided) { fields.push(`project_id = $${paramIndex++}`); values.push(projectResult.value || null); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push("updated_at = NOW()");
    const result = await transaction(async (client) => {
      const existing = await client.query(
        `SELECT rl.* FROM reading_list rl
         WHERE ${projectScopedAccessCondition("rl")} AND rl.id = $2
         FOR UPDATE`,
        [request.user.id, id]
      );
      if (existing.rows.length === 0) throw Object.assign(new Error("Item not found"), { status: 404 });
      if (!(await canEditProjectItem(request.user.id, existing.rows[0], client))) {
        throw Object.assign(new Error("Only the item creator or project creator can edit this reading item"), { status: 403 });
      }
      if (resourceResult.provided && !(await userOwnsResource(request.user.id, resourceResult.value, client))) {
        throw Object.assign(new Error("Resource not found"), { status: 400 });
      }
      if (projectResult.provided && !(await userCanAccessProject(request.user.id, projectResult.value, client))) {
        throw Object.assign(new Error("Project not found"), { status: 400 });
      }
      values.push(id);
      return client.query(
        `UPDATE reading_list SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
    });

    return apiResponse({ item: result.rows[0] });
  } catch (error) {
    if (error.status) return apiError(error.message, error.status);
    console.error("Reading list update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const existing = await query(
      `SELECT rl.* FROM reading_list rl
       WHERE ${projectScopedAccessCondition("rl")} AND rl.id = $2`,
      [request.user.id, id]
    );

    if (existing.rows.length === 0) {
      return apiError("Item not found", 404);
    }
    if (!(await canDeleteProjectItem(request.user.id, existing.rows[0]))) {
      return apiError("Only the project creator can delete project reading items", 403);
    }

    await query("DELETE FROM reading_list WHERE id = $1", [id]);

    return apiResponse({ message: "Item deleted" });
  } catch (error) {
    console.error("Reading list delete error:", error);
    return apiError("Internal server error", 500);
  }
});
