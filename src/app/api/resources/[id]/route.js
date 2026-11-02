import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalEnum, optionalString, optionalUuid } from "@/lib/apiValidation";
import { deleteBlobs } from "@/lib/blobStorage";
import { RESOURCE_SELECT, RESOURCE_TYPES, findResourceFile, normalizeLinkUrl } from "@/lib/resourceFiles";
import { fileUrl } from "@/lib/uploadRules";

// Removes an uploaded file's row and returns its blob path for deletion
// after the transaction commits.
async function removeFile(client, fileId) {
  if (!fileId) return [];
  const removed = await client.query("DELETE FROM uploaded_files WHERE id = $1 RETURNING pathname", [fileId]);
  return removed.rows.map((row) => row.pathname);
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Resource", { allowNull: false }).error) return apiError("Resource not found", 404);

    const result = await query(`${RESOURCE_SELECT} WHERE r.id = $1 AND r.user_id = $2`, [id, request.user.id]);

    if (result.rows.length === 0) {
      return apiError("Resource not found", 404);
    }

    return apiResponse({ resource: result.rows[0] });
  } catch (error) {
    console.error("Resource get error:", error);
    return apiError("Internal server error", 500);
  }
});

// A resource holds either an uploaded file (fileId) or a link (fileUrl).
// Switching away from an uploaded file, or replacing it, deletes the old one.
export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Resource", { allowNull: false }).error) return apiError("Resource not found", 404);
    const body = await request.json().catch(() => ({}));
    const { title, type, fileUrl: linkUrl, notes } = body;

    const titleResult = optionalString(title, "Title", { max: 255, emptyToNull: false });
    const typeResult = optionalEnum(type, "Type", RESOURCE_TYPES);
    const fileUrlResult = optionalString(linkUrl, "File URL", { max: 2048 });
    const notesResult = optionalString(notes, "Notes", { max: 10_000, trim: false });
    const fileIdResult = optionalUuid(body.fileId, "File");
    const validationError = firstValidationError(titleResult, typeResult, fileUrlResult, notesResult, fileIdResult);
    if (validationError) return apiError(validationError);

    const existing = await query("SELECT id, file_id FROM resources WHERE id = $1 AND user_id = $2", [id, request.user.id]);
    const resource = existing.rows[0];
    if (!resource) return apiError("Resource not found", 404);

    const fields = [];
    const values = [];
    let paramIndex = 1;
    let replacedFileId = null;

    if (titleResult.provided) { fields.push(`title = $${paramIndex++}`); values.push(titleResult.value); }
    if (typeResult.provided) { fields.push(`type = $${paramIndex++}`); values.push(typeResult.value); }
    if (notesResult.provided) { fields.push(`notes = $${paramIndex++}`); values.push(notesResult.value); }

    if (fileIdResult.value) {
      if (fileIdResult.value !== resource.file_id) {
        const file = await findResourceFile(request.user.id, fileIdResult.value, id);
        if (!file) return apiError("Uploaded file not found", 404);
        fields.push(`file_id = $${paramIndex++}`, `file_url = $${paramIndex++}`, `file_size_bytes = $${paramIndex++}`);
        values.push(file.id, fileUrl(file.id), file.size_bytes);
        replacedFileId = resource.file_id;
      }
    } else if (fileUrlResult.provided || fileIdResult.provided) {
      let normalizedUrl = null;
      try { normalizedUrl = normalizeLinkUrl(fileUrlResult.value); }
      catch (error) { return apiError(error.message); }
      fields.push(`file_id = NULL`, `file_url = $${paramIndex++}`, `file_size_bytes = NULL`);
      values.push(normalizedUrl);
      replacedFileId = resource.file_id;
    }

    if (fields.length === 0) {
      return apiError("No fields to update");
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, request.user.id);

    const removedPaths = await transaction(async (client) => {
      await client.query(
        `UPDATE resources SET ${fields.join(", ")} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
        values
      );
      return removeFile(client, replacedFileId);
    });
    await deleteBlobs(removedPaths);

    const result = await query(`${RESOURCE_SELECT} WHERE r.id = $1`, [id]);
    return apiResponse({ resource: result.rows[0] });
  } catch (error) {
    console.error("Resource update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Resource", { allowNull: false }).error) return apiError("Resource not found", 404);

    const removedPaths = await transaction(async (client) => {
      const result = await client.query(
        "DELETE FROM resources WHERE id = $1 AND user_id = $2 RETURNING id, file_id",
        [id, request.user.id]
      );
      if (result.rows.length === 0) return null;
      return removeFile(client, result.rows[0].file_id);
    });

    if (removedPaths === null) {
      return apiError("Resource not found", 404);
    }
    await deleteBlobs(removedPaths);

    return apiResponse({ message: "Resource deleted" });
  } catch (error) {
    console.error("Resource delete error:", error);
    return apiError("Internal server error", 500);
  }
});
