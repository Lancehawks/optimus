import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalEnum, optionalString } from "@/lib/apiValidation";
import { normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";

const RESOURCE_TYPES = ["pdf", "doc", "image", "link", "other"];

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
    const body = await request.json().catch(() => ({}));
    const { title, type, fileUrl, notes } = body;

    const titleResult = optionalString(title, "Title", { max: 255, emptyToNull: false });
    const typeResult = optionalEnum(type, "Type", RESOURCE_TYPES);
    const fileUrlResult = optionalString(fileUrl, "File URL", { max: 2048 });
    const notesResult = optionalString(notes, "Notes", { max: 10_000, trim: false });
    const validationError = firstValidationError(titleResult, typeResult, fileUrlResult, notesResult);
    if (validationError) return apiError(validationError);
    let normalizedFileUrl = fileUrlResult.value;
    if (fileUrlResult.provided && normalizedFileUrl && !normalizedFileUrl.startsWith("/uploads/")) {
      try { normalizedFileUrl = normalizePublicHttpUrl(normalizedFileUrl).toString(); }
      catch (error) { return apiError(error.message); }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (titleResult.provided) { fields.push(`title = $${paramIndex++}`); values.push(titleResult.value); }
    if (typeResult.provided) { fields.push(`type = $${paramIndex++}`); values.push(typeResult.value); }
    if (fileUrlResult.provided) { fields.push(`file_url = $${paramIndex++}`); values.push(normalizedFileUrl); }
    if (notesResult.provided) { fields.push(`notes = $${paramIndex++}`); values.push(notesResult.value); }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, request.user.id);

    const result = await query(
      `UPDATE resources SET ${fields.join(", ")} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return apiError("Resource not found", 404);

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
