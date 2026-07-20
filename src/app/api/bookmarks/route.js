import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalString, optionalUuid, requiredString, uuidArray } from "@/lib/apiValidation";
import { userOwnsAllTags } from "@/lib/tagAccess";
import { userOwnsBookmarkCollection } from "@/lib/resourceAccess";
import { fetchPublicPageMetadata, normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";
import { decodeCursor, finishCursorPage, readPageSize } from "@/lib/cursorPagination";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collection_id");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"), ["createdAt", "id"]);
    if (cursor.error) return apiError(cursor.error);

    const collectionValidation = optionalUuid(collectionId || undefined, "Collection");
    const tagValidation = optionalUuid(tag || undefined, "Tag");
    const filterError = firstValidationError(collectionValidation, tagValidation);
    if (filterError) return apiError(filterError);
    if (search && search.length > 200) return apiError("Search must be 200 characters or less");

    const conditions = ["b.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (collectionId) {
      conditions.push(`b.collection_id = $${paramIndex++}`);
      params.push(collectionId);
    }
    if (search) {
      conditions.push(`(b.title ILIKE $${paramIndex} OR b.url ILIKE $${paramIndex} OR b.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (tag) {
      conditions.push(`b.id IN (SELECT bt2.bookmark_id FROM bookmark_tags bt2 WHERE bt2.tag_id = $${paramIndex++})`);
      params.push(tag);
    }

    const cursorCondition = cursor.value
      ? `WHERE (b.created_at, b.id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`
      : "";
    if (cursor.value) params.push(cursor.value.createdAt, cursor.value.id);

    const result = await query(
      `WITH filtered_bookmarks AS (
         SELECT b.* FROM bookmarks b WHERE ${conditions.join(" AND ")}
       )
       SELECT b.*,
        bc.name AS collection_name,
        tag_rollup.tags,
        (SELECT COUNT(*)::int FROM filtered_bookmarks) AS __filtered_count,
        (SELECT COUNT(*)::int FROM bookmarks all_b WHERE all_b.user_id = $1) AS __total_count
       FROM filtered_bookmarks b
       LEFT JOIN bookmark_collections bc ON bc.id = b.collection_id AND bc.user_id = b.user_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)), '[]') AS tags
         FROM bookmark_tags bt JOIN tags tg ON tg.id = bt.tag_id AND tg.user_id = b.user_id
         WHERE bt.bookmark_id = b.id
       ) tag_rollup ON TRUE
       ${cursorCondition}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT $${paramIndex}`,
      [...params, limit + 1]
    );

    const counts = result.rows[0] || {};
    const page = finishCursorPage(result.rows, limit, (row) => ({ createdAt: row.created_at, id: row.id }));
    const bookmarks = page.items.map(({ __filtered_count, __total_count, ...bookmark }) => bookmark);
    return apiResponse({ bookmarks, pagination: { ...page.pagination, totalCount: counts.__total_count || 0, filteredCount: counts.__filtered_count || 0 } });
  } catch (error) {
    console.error("Bookmarks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { url, title, description, collectionId, tags } = body;
    const urlResult = requiredString(url, "URL", { max: 2048 });
    const titleResult = optionalString(title, "Title", { max: 255 });
    const descriptionResult = optionalString(description, "Description", { max: 2000 });
    const collectionResult = optionalUuid(collectionId, "Collection");
    const tagsResult = uuidArray(tags, "Tags", { max: 20 });
    const validationError = firstValidationError(urlResult, titleResult, descriptionResult, collectionResult, tagsResult);
    if (validationError) return apiError(validationError);

    let normalizedUrl;
    try {
      normalizedUrl = normalizePublicHttpUrl(urlResult.value).toString();
    } catch (error) {
      return apiError(error.message);
    }

    // Auto-fetch metadata
    let autoTitle = titleResult.value || "";
    let faviconUrl = null;
    let previewImageUrl = null;

    if (!titleResult.value) {
      try {
        const metadata = await fetchPublicPageMetadata(normalizedUrl);
        autoTitle = metadata.title;
        previewImageUrl = metadata.previewImageUrl;
      } catch {
        // Metadata fetch is best-effort, continue without it
      }
    }

    const urlObj = new URL(normalizedUrl);
    faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(urlObj.hostname)}&sz=32`;

    const bookmark = await transaction(async (client) => {
      const selectedCollection = collectionResult.value || null;
      const selectedTags = tagsResult.value || [];
      if (!(await userOwnsBookmarkCollection(request.user.id, selectedCollection, client))) {
        throw Object.assign(new Error("Collection not found"), { status: 400 });
      }
      if (!(await userOwnsAllTags(request.user.id, selectedTags, client))) {
        throw Object.assign(new Error("One or more tags are invalid"), { status: 400 });
      }

      const result = await client.query(
        `INSERT INTO bookmarks (user_id, collection_id, url, title, description, favicon_url, preview_image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [request.user.id, selectedCollection, normalizedUrl, titleResult.value || autoTitle || normalizedUrl,
          descriptionResult.value || null, faviconUrl, previewImageUrl]
      );
      const created = result.rows[0];
      if (selectedTags.length > 0) {
        await client.query(
          `INSERT INTO bookmark_tags (bookmark_id, tag_id)
           SELECT $1, tag_id FROM unnest($2::uuid[]) AS tag_id
           ON CONFLICT DO NOTHING`,
          [created.id, selectedTags]
        );
      }
      return created;
    });

    return apiResponse({ bookmark }, 201);
  } catch (error) {
    if (error.status === 400) return apiError(error.message);
    console.error("Bookmark create error:", error);
    return apiError("Internal server error", 500);
  }
});
