import { query } from "@/lib/db";

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

export async function userOwnsAllTags(userId, tagIds, db = query) {
  if (!userId || !Array.isArray(tagIds) || tagIds.length === 0) return true;

  const uniqueTagIds = [...new Set(tagIds)];
  const result = await runQuery(
    db,
    `SELECT COUNT(DISTINCT id)::int AS count
     FROM tags
     WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, uniqueTagIds]
  );

  return (result.rows[0]?.count || 0) === uniqueTagIds.length;
}
