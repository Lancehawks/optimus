import { query } from "@/lib/db";
import { normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";

export const RESOURCE_TYPES = ["pdf", "doc", "image", "link", "other"];

// Resources with the name and type of their uploaded file, when they have one.
// Filters must qualify resource columns with `r.`.
export const RESOURCE_SELECT = `SELECT r.*, f.name AS file_name, f.content_type AS file_content_type
  FROM resources r
  LEFT JOIN uploaded_files f ON f.id = r.file_id`;

// Links are public http(s) URLs; /uploads/ paths are kept from older releases.
export function normalizeLinkUrl(value) {
  if (!value) return null;
  if (value.startsWith("/uploads/")) return value;
  return normalizePublicHttpUrl(value).toString();
}

// An uploaded resource file the member owns that no other resource uses.
export async function findResourceFile(userId, fileId, exceptResourceId = null) {
  const result = await query(
    `SELECT f.id, f.name, f.content_type, f.size_bytes
     FROM uploaded_files f
     WHERE f.id = $1
       AND f.user_id = $2
       AND f.purpose = 'resource'
       AND NOT EXISTS (
         SELECT 1 FROM resources other
         WHERE other.file_id = f.id AND ($3::uuid IS NULL OR other.id <> $3::uuid)
       )`,
    [fileId, userId, exceptResourceId]
  );
  return result.rows[0] || null;
}
