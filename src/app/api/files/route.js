import { head } from "@vercel/blob";
import { query } from "@/lib/db";
import { withAuth, apiError, apiResponse } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { BLOB_NOT_CONFIGURED, deleteBlobs, isBlobConfigured } from "@/lib/blobStorage";
import { canEditNote } from "@/lib/noteAccess";
import {
  UPLOAD_RULES,
  displayFileName,
  fileUrl,
  isAllowedContentType,
  isOwnPathname,
  isUploadPurpose,
  normalizeContentType,
} from "@/lib/uploadRules";
import { logError } from "@/lib/logger";

// Registers a blob the browser just uploaded. Size and type come from the
// blob itself, not the request, and the blob must sit under the member's own
// prefix for this purpose.
export const POST = withAuth(async (request) => {
  if (!isBlobConfigured()) return apiError(BLOB_NOT_CONFIGURED, 503);

  const { data: body, error: bodyError } = await parseJsonObject(request);
  if (bodyError) return apiError(bodyError);

  const userId = request.user.id;
  const { pathname, purpose, name } = body;
  if (!isUploadPurpose(purpose)) return apiError("Upload purpose is invalid");
  if (!isOwnPathname(pathname, userId, purpose)) return apiError("This file isn't yours to register", 403);
  const noteId = optionalUuid(body.noteId, "Note");
  if (noteId.error) return apiError(noteId.error);
  if (purpose === "note" && !noteId.value) return apiError("Note is required");

  try {
    if (noteId.value && !(await canEditNote(userId, noteId.value))) {
      return apiError("Note not found", 404);
    }

    let blob;
    try {
      blob = await head(pathname);
    } catch {
      return apiError("The upload wasn't found. Try again.", 404);
    }

    const contentType = normalizeContentType(blob.contentType);
    const rules = UPLOAD_RULES[purpose];
    if (!isAllowedContentType(purpose, contentType) || blob.size > rules.maxBytes) {
      await deleteBlobs([pathname]);
      return apiError("That file type or size isn't allowed", 400);
    }

    const result = await query(
      `INSERT INTO uploaded_files (user_id, purpose, note_id, pathname, name, content_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (pathname) DO NOTHING
       RETURNING id, purpose, note_id, name, content_type, size_bytes, created_at`,
      [userId, purpose, noteId.value || null, pathname, displayFileName(name), contentType, blob.size]
    );
    if (!result.rows[0]) return apiError("This file is already registered", 409);

    const file = result.rows[0];
    return apiResponse({ file: { ...file, url: fileUrl(file.id) } }, 201);
  } catch (error) {
    logError("files.register_failed", error, { userId, purpose });
    // The blob is the member's own and was never registered, so nothing
    // else can reach it.
    await deleteBlobs([pathname]);
    return apiError("Could not save the upload", 500);
  }
});
