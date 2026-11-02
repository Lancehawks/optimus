import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalUuid, requiredString } from "@/lib/apiValidation";
import { userOwnsBookmarkCollection } from "@/lib/resourceAccess";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT bc.*,
        (SELECT COUNT(*) FROM bookmarks b WHERE b.collection_id = bc.id)::int AS bookmark_count
       FROM bookmark_collections bc
       WHERE bc.user_id = $1
       ORDER BY bc.position ASC, bc.name ASC`,
      [request.user.id]
    );

    return apiResponse({ collections: result.rows });
  } catch (error) {
    console.error("Bookmark collections list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { name, parentId } = await request.json().catch(() => ({}));
    const nameResult = requiredString(name, "Collection name", { max: 150 });
    const parentResult = optionalUuid(parentId, "Parent collection");
    const validationError = firstValidationError(nameResult, parentResult);
    if (validationError) return apiError(validationError);

    const result = await transaction(async (client) => {
      if (!(await userOwnsBookmarkCollection(request.user.id, parentResult.value, client))) {
        throw Object.assign(new Error("Parent collection not found"), { status: 400 });
      }
      // Serialize position allocation per user without a race between requests.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bookmark-collections:${request.user.id}`]);
      return client.query(
        `INSERT INTO bookmark_collections (user_id, name, parent_id, position)
         SELECT $1, $2, $3, COALESCE(MAX(position), -1) + 1
         FROM bookmark_collections WHERE user_id = $1
         RETURNING *`,
        [request.user.id, nameResult.value, parentResult.value || null]
      );
    });

    return apiResponse({ collection: { ...result.rows[0], bookmark_count: 0 } }, 201);
  } catch (error) {
    if (error.status) return apiError(error.message, error.status);
    console.error("Bookmark collection create error:", error);
    return apiError("Internal server error", 500);
  }
});
