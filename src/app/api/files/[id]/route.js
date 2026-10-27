import { get } from "@vercel/blob";
import { query } from "@/lib/db";
import { withAuth, apiError, apiResponse } from "@/lib/apiUtils";
import { optionalUuid } from "@/lib/apiValidation";
import { BLOB_NOT_CONFIGURED, deleteBlobs, isBlobConfigured } from "@/lib/blobStorage";
import { projectScopedAccessCondition } from "@/lib/projectAccess";
import { isInlineContentType } from "@/lib/uploadRules";
import { logError } from "@/lib/logger";

// Who can open a file: its uploader, anyone who can open the note it was
// attached to, a project logo's project members, or, for a profile photo
// that is someone's avatar, any signed-in member.
async function findReadableFile(userId, fileId) {
  const result = await query(
    `SELECT f.*
     FROM uploaded_files f
     LEFT JOIN notes n ON n.id = f.note_id
     WHERE f.id = $2
       AND (f.user_id = $1 OR (n.id IS NOT NULL AND ${projectScopedAccessCondition("n")})
         OR (f.purpose = 'project_logo' AND EXISTS (
           SELECT 1 FROM projects p
           JOIN project_members pm ON pm.project_id = p.id
           WHERE p.logo_file_id = f.id AND pm.user_id = $1
         ))
         OR (f.purpose = 'avatar' AND EXISTS (
           SELECT 1 FROM users u WHERE u.avatar_url = 'file:' || f.id::text
         )))`,
    [userId, fileId]
  );
  return result.rows[0] || null;
}

function contentDisposition(file, download) {
  const type = download || !isInlineContentType(file.content_type) ? "attachment" : "inline";
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`;
}

// Streams a private blob after checking access. Uploaded files never run as
// part of this origin: types are allow-listed at upload, and the response is
// sandboxed and never sniffed.
export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (optionalUuid(id, "File", { allowNull: false }).error) return apiError("File not found", 404);
  if (!isBlobConfigured()) return apiError(BLOB_NOT_CONFIGURED, 503);

  try {
    const file = await findReadableFile(request.user.id, id);
    if (!file) return apiError("File not found", 404);

    const ifNoneMatch = request.headers.get("if-none-match") || undefined;
    const blob = await get(file.pathname, { access: "private", ifNoneMatch });
    if (!blob) return apiError("File not found", 404);

    // Chrome's PDF viewer refuses sandboxed documents; it is isolated anyway.
    const sandbox = file.content_type === "application/pdf" ? "" : "sandbox; ";
    const headers = new Headers({
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": `${sandbox}default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; object-src 'self'`,
      "X-Content-Type-Options": "nosniff",
      ETag: blob.blob.etag,
    });
    if (blob.statusCode === 304) return new Response(null, { status: 304, headers });

    const download = new URL(request.url).searchParams.get("download") === "1";
    headers.set("Content-Type", file.content_type);
    headers.set("Content-Length", String(blob.blob.size));
    headers.set("Content-Disposition", contentDisposition(file, download));
    return new Response(blob.stream, { status: 200, headers });
  } catch (error) {
    logError("files.read_failed", error, { userId: request.user.id, fileId: id });
    return apiError("Could not load the file", 500);
  }
});

// Only the uploader removes a file.
export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;
  if (optionalUuid(id, "File", { allowNull: false }).error) return apiError("File not found", 404);

  try {
    const result = await query(
      "DELETE FROM uploaded_files WHERE id = $1 AND user_id = $2 RETURNING pathname",
      [id, request.user.id]
    );
    if (!result.rows[0]) return apiError("File not found", 404);
    await deleteBlobs([result.rows[0].pathname]);
    return apiResponse({ message: "File deleted" });
  } catch (error) {
    logError("files.delete_failed", error, { userId: request.user.id, fileId: id });
    return apiError("Could not delete the file", 500);
  }
});
