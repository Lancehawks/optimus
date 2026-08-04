import { query } from "@/lib/db";

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

export async function getProjectMemberCount(projectId) {
  if (!projectId) return 0;

  const result = await query(
    "SELECT COUNT(*)::int AS count FROM project_members WHERE project_id = $1",
    [projectId]
  );

  return result.rows[0]?.count || 0;
}

export async function recordProjectActivity({
  projectId,
  actorUserId,
  action,
  entityType,
  entityId = null,
  entityTitle = null,
  metadata = {},
  db = query,
  strict = false,
}) {
  if (!projectId || !actorUserId || !action || !entityType) return null;

  try {
    const activity = await runQuery(
      db,
      `INSERT INTO project_activity
         (project_id, actor_user_id, action, entity_type, entity_id, entity_title, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        projectId,
        actorUserId,
        action,
        entityType,
        entityId,
        entityTitle,
        JSON.stringify(metadata || {}),
      ]
    );

    const row = activity.rows[0];
    if (!row) return null;

    return row;
  } catch (error) {
    console.error("Project activity record error:", error);
    if (strict) throw error;
    return null;
  }
}

export async function listProjectActivity(projectId, userId, limit = 20) {
  const result = await query(
    `SELECT
       pa.id,
       pa.action,
       pa.entity_type,
       pa.entity_id,
       pa.entity_title,
       pa.metadata,
       pa.created_at,
       actor.id AS actor_id,
       COALESCE(actor.full_name, 'Deleted account') AS actor_full_name,
       actor.avatar_url AS actor_avatar_url
     FROM project_activity pa
     JOIN project_members pm ON pm.project_id = pa.project_id AND pm.user_id = $2
     LEFT JOIN users actor ON actor.id = pa.actor_user_id
     WHERE pa.project_id = $1
     ORDER BY pa.created_at DESC
     LIMIT $3`,
    [projectId, userId, limit]
  );

  return result.rows;
}
