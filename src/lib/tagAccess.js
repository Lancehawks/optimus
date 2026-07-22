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

async function userOwnsOrItemAlreadyUsesAllTags({ userId, tagIds, itemId, itemType, db = query }) {
  if (!userId || !Array.isArray(tagIds) || tagIds.length === 0) return true;

  const joinConfig = {
    task: { table: "task_tags", itemColumn: "task_id" },
    note: { table: "note_tags", itemColumn: "note_id" },
  }[itemType];
  if (!joinConfig || !itemId) return false;

  const uniqueTagIds = [...new Set(tagIds)];
  const result = await runQuery(
    db,
    `SELECT COUNT(DISTINCT tag.id)::int AS count
     FROM tags tag
     WHERE tag.id = ANY($2::uuid[])
       AND (
         tag.user_id = $1
         OR EXISTS (
           SELECT 1
           FROM ${joinConfig.table} item_tag
           WHERE item_tag.tag_id = tag.id
             AND item_tag.${joinConfig.itemColumn} = $3
         )
       )`,
    [userId, uniqueTagIds, itemId]
  );

  return (result.rows[0]?.count || 0) === uniqueTagIds.length;
}

// A project creator editing a collaborator's item may retain or remove the
// tags already visible on that item, but cannot attach the collaborator's
// unrelated private tags.
export function userOwnsOrTaskUsesAllTags(userId, tagIds, taskId, db = query) {
  return userOwnsOrItemAlreadyUsesAllTags({ userId, tagIds, itemId: taskId, itemType: "task", db });
}

export function userOwnsOrNoteUsesAllTags(userId, tagIds, noteId, db = query) {
  return userOwnsOrItemAlreadyUsesAllTags({ userId, tagIds, itemId: noteId, itemType: "note", db });
}
