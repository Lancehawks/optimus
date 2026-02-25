import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collection_id");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");

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
       WHERE ${conditions.join(" AND ")}
       GROUP BY b.id, bc.name
       ORDER BY b.created_at DESC`,
      params
    );

    return apiResponse({ bookmarks: result.rows });
  } catch (error) {
    console.error("Bookmarks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { url, title, description, collectionId, tags } = body;

    if (!url) {
      return apiError("URL is required");
    }

    // Auto-fetch metadata
    let autoTitle = title || "";
    let faviconUrl = null;
    let previewImageUrl = null;

    if (!title || !faviconUrl) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Optimus/1.0)" },
        });
        const html = await response.text();

        // Extract title via regex
        if (!title) {
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch) {
            autoTitle = titleMatch[1].trim().substring(0, 255);
          }
        }

        // Extract og:image
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (ogImageMatch) {
          previewImageUrl = ogImageMatch[1];
        }
      } catch (fetchError) {
        // Metadata fetch is best-effort, continue without it
      }

      // Get favicon via Google favicons API
      try {
        const urlObj = new URL(url);
        faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
      } catch (urlError) {
        // Invalid URL for favicon, skip
      }
    }

    const result = await query(
      `INSERT INTO bookmarks (user_id, collection_id, url, title, description, favicon_url, preview_image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        request.user.id,
        collectionId || null,
        url,
        title || autoTitle || url,
        description || null,
        faviconUrl,
        previewImageUrl,
      ]
    );

    const bookmark = result.rows[0];

    // Add tags
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await query(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [bookmark.id, tagId]
        );
      }
    }

    return apiResponse({ bookmark }, 201);
  } catch (error) {
    console.error("Bookmark create error:", error);
    return apiError("Internal server error", 500);
  }
});
