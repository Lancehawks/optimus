import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalEnum, optionalString, requiredString } from "@/lib/apiValidation";
import { normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";
import { decodeCursor, finishCursorPage, readPageSize } from "@/lib/cursorPagination";

const RESOURCE_TYPES = ["pdf", "doc", "image", "link", "other"];

function normalizeFileUrl(value) {
  if (!value) return null;
  if (value.startsWith("/uploads/")) return value;
  return normalizePublicHttpUrl(value).toString();
}

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"), ["createdAt", "id"]);
    if (cursor.error) return apiError(cursor.error);

    const conditions = ["user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (type) {
      if (!RESOURCE_TYPES.includes(type)) return apiError("Invalid resource type");
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }
    if (search) {
      if (search.length > 200) return apiError("Search must be 200 characters or less");
      conditions.push(`(title ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const cursorCondition = cursor.value
      ? `WHERE (created_at, id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`
      : "";
    if (cursor.value) params.push(cursor.value.createdAt, cursor.value.id);

    const result = await query(
      `WITH filtered_resources AS (
         SELECT * FROM resources WHERE ${conditions.join(" AND ")}
       )
       SELECT *,
              (SELECT COUNT(*)::int FROM filtered_resources) AS __filtered_count,
              (SELECT COUNT(*)::int FROM resources all_resources WHERE all_resources.user_id = $1) AS __total_count
       FROM filtered_resources
       ${cursorCondition}
       ORDER BY created_at DESC, id DESC
       LIMIT $${paramIndex}`,
      [...params, limit + 1]
    );

    const counts = result.rows[0] || {};
    const page = finishCursorPage(result.rows, limit, (row) => ({ createdAt: row.created_at, id: row.id }));
    const resources = page.items.map(({ __filtered_count, __total_count, ...resource }) => resource);
    return apiResponse({ resources, pagination: { ...page.pagination, totalCount: counts.__total_count || 0, filteredCount: counts.__filtered_count || 0 } });
  } catch (error) {
    console.error("Resources list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { title, type, fileUrl, notes } = body;
    const titleResult = requiredString(title, "Title", { max: 255 });
    const typeResult = optionalEnum(type, "Type", RESOURCE_TYPES);
    const fileUrlResult = optionalString(fileUrl, "File URL", { max: 2048 });
    const notesResult = optionalString(notes, "Notes", { max: 10_000, trim: false });
    const validationError = firstValidationError(titleResult, typeResult, fileUrlResult, notesResult);
    if (validationError || !typeResult.provided) return apiError(validationError || "Type is required");
    let normalizedFileUrl;
    try { normalizedFileUrl = normalizeFileUrl(fileUrlResult.value); }
    catch (error) { return apiError(error.message); }

    const result = await query(
      `INSERT INTO resources (user_id, title, type, file_url, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [request.user.id, titleResult.value, typeResult.value, normalizedFileUrl, notesResult.value || null]
    );

    return apiResponse({ resource: result.rows[0] }, 201);
  } catch (error) {
    console.error("Resource create error:", error);
    return apiError("Internal server error", 500);
  }
});
