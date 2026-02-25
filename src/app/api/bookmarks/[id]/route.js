import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

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
       LEFT JOIN bookmark_collections bc ON bc.id = b.collection_id
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags tg ON tg.id = bt.tag_id
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

    // Verify ownership
    const existing = await query(
      "SELECT id FROM bookmarks WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) {
      return apiError("Bookmark not found", 404);
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(title); }
    if (url !== undefined) { fields.push(`url = $${paramIndex++}`); values.push(url); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (collectionId !== undefined) { fields.push(`collection_id = $${paramIndex++}`); values.push(collectionId || null); }
    if (faviconUrl !== undefined) { fields.push(`favicon_url = $${paramIndex++}`); values.push(faviconUrl); }
    if (previewImageUrl !== undefined) { fields.push(`preview_image_url = $${paramIndex++}`); values.push(previewImageUrl); }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await query(
        `UPDATE bookmarks SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Update tags
    if (tags !== undefined) {
      await query("DELETE FROM bookmark_tags WHERE bookmark_id = $1", [id]);
      for (const tagId of tags) {
        await query(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, tagId]
        );
      }
    }

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
       LEFT JOIN bookmark_collections bc ON bc.id = b.collection_id
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags tg ON tg.id = bt.tag_id
       WHERE b.id = $1
       GROUP BY b.id, bc.name`,
      [id]
    );

    return apiResponse({ bookmark: result.rows[0] });
  } catch (error) {
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
