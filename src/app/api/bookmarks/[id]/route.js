import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalString, optionalUuid, uuidArray } from "@/lib/apiValidation";
import { userOwnsAllTags } from "@/lib/tagAccess";
import { userOwnsBookmarkCollection } from "@/lib/resourceAccess";
import { normalizePublicHttpUrl } from "@/lib/safeRemoteMetadata";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT b.*,
        bc.name AS collection_name,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM bookmarks b
       LEFT JOIN bookmark_collections bc ON bc.id = b.collection_id AND bc.user_id = b.user_id
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags tg ON tg.id = bt.tag_id AND tg.user_id = b.user_id
       WHERE b.id = $1 AND b.user_id = $2
       GROUP BY b.id, bc.name`,
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Bookmark not found", 404);
    }

    return apiResponse({ bookmark: result.rows[0] });
  } catch (error) {
    console.error("Bookmark get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, url, description, collectionId, faviconUrl, previewImageUrl, tags } = body;

    const titleResult = optionalString(title, "Title", { max: 255, emptyToNull: false });
    const urlResult = optionalString(url, "URL", { max: 2048, emptyToNull: false });
    const descriptionResult = optionalString(description, "Description", { max: 2000 });
    const collectionResult = optionalUuid(collectionId, "Collection");
    const tagsResult = uuidArray(tags, "Tags", { max: 20 });
    const validationError = firstValidationError(titleResult, urlResult, descriptionResult, collectionResult, tagsResult);
    if (validationError) return apiError(validationError);
    let normalizedUrl = urlResult.value;
    if (urlResult.provided) {
      try { normalizedUrl = normalizePublicHttpUrl(urlResult.value).toString(); }
      catch (error) { return apiError(error.message); }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (titleResult.provided) { fields.push(`title = $${paramIndex++}`); values.push(titleResult.value); }
    if (urlResult.provided) { fields.push(`url = $${paramIndex++}`); values.push(normalizedUrl); }
    if (descriptionResult.provided) { fields.push(`description = $${paramIndex++}`); values.push(descriptionResult.value); }
    if (collectionResult.provided) { fields.push(`collection_id = $${paramIndex++}`); values.push(collectionResult.value); }
    if (faviconUrl !== undefined) { fields.push(`favicon_url = $${paramIndex++}`); values.push(faviconUrl); }
    if (previewImageUrl !== undefined) { fields.push(`preview_image_url = $${paramIndex++}`); values.push(previewImageUrl); }

    await transaction(async (client) => {
      const existing = await client.query(
        "SELECT id FROM bookmarks WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, request.user.id]
      );
      if (existing.rows.length === 0) throw Object.assign(new Error("Bookmark not found"), { status: 404 });
      if (collectionResult.provided && !(await userOwnsBookmarkCollection(request.user.id, collectionResult.value, client))) {
        throw Object.assign(new Error("Collection not found"), { status: 400 });
      }
      if (tagsResult.provided && !(await userOwnsAllTags(request.user.id, tagsResult.value, client))) {
        throw Object.assign(new Error("One or more tags are invalid"), { status: 400 });
      }
      if (fields.length > 0) {
        fields.push("updated_at = NOW()");
        values.push(id, request.user.id);
        await client.query(
          `UPDATE bookmarks SET ${fields.join(", ")} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
          values
        );
      }
      if (tagsResult.provided) {
        await client.query("DELETE FROM bookmark_tags WHERE bookmark_id = $1", [id]);
        if (tagsResult.value.length > 0) {
          await client.query(
            `INSERT INTO bookmark_tags (bookmark_id, tag_id)
             SELECT $1, tag_id FROM unnest($2::uuid[]) AS tag_id`,
            [id, tagsResult.value]
          );
        }
      }
    });

    // Return updated bookmark with tags
    const result = await query(
      `SELECT b.*,
        bc.name AS collection_name,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM bookmarks b
       LEFT JOIN bookmark_collections bc ON bc.id = b.collection_id AND bc.user_id = b.user_id
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags tg ON tg.id = bt.tag_id AND tg.user_id = b.user_id
       WHERE b.id = $1
       GROUP BY b.id, bc.name`,
      [id]
    );

    return apiResponse({ bookmark: result.rows[0] });
  } catch (error) {
    if (error.status) return apiError(error.message, error.status);
    console.error("Bookmark update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const result = await query(
      "DELETE FROM bookmarks WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Bookmark not found", 404);
    }

    return apiResponse({ message: "Bookmark deleted" });
  } catch (error) {
    console.error("Bookmark delete error:", error);
    return apiError("Internal server error", 500);
  }
});
