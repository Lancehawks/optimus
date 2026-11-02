import { query } from "@/lib/db";

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

export async function userOwnsBookmarkCollection(userId, collectionId, db = query) {
  if (!collectionId) return true;
  const result = await runQuery(
    db,
    "SELECT 1 FROM bookmark_collections WHERE id = $1 AND user_id = $2",
    [collectionId, userId]
  );
  return result.rows.length > 0;
}

export async function userOwnsResource(userId, resourceId, db = query) {
  if (!resourceId) return true;
  const result = await runQuery(
    db,
    "SELECT 1 FROM resources WHERE id = $1 AND user_id = $2",
    [resourceId, userId]
  );
  return result.rows.length > 0;
}

export async function userCanAccessProject(userId, projectId, db = query) {
  if (!projectId) return true;
  const result = await runQuery(
    db,
    `SELECT 1
     FROM projects p
     WHERE p.id = $1
       AND (
         p.user_id = $2 OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = p.id AND pm.user_id = $2
         )
       )`,
    [projectId, userId]
  );
  return result.rows.length > 0;
}
