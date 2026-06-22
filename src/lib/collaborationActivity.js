import { query } from "@/lib/db";

const actionCopy = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  moved_to_project: "shared",
  moved_to_personal: "moved to personal",
  completed: "completed",
  invited: "invited",
  joined: "joined",
  removed: "removed",
};

const entityCopy = {
  task: "task",
  note: "note",
  event: "calendar event",
  project: "project",
  milestone: "milestone",
  member: "collaborator",
};

function buildTitle(action, entityType, entityTitle) {
  const actionText = actionCopy[action] || action.replaceAll("_", " ");
  const entityText = entityCopy[entityType] || entityType;
  return `${actionText} ${entityText}${entityTitle ? `: ${entityTitle}` : ""}`;
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
}) {
  if (!projectId || !actorUserId || !action || !entityType) return null;

  try {
    const activity = await query(
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

    const title = buildTitle(action, entityType, entityTitle);
    const body = metadata?.body || null;

    await query(
      `INSERT INTO notifications
         (user_id, actor_user_id, project_id, activity_id, type, entity_type, entity_id, title, body, metadata)
       SELECT pm.user_id, $2, $1, $3, 'project_activity', $4, $5, $6, $7, $8::jsonb
       FROM project_members pm
       WHERE pm.project_id = $1
         AND pm.user_id <> $2`,
      [
        projectId,
        actorUserId,
        row.id,
        entityType,
        entityId,
        title,
        body,
        JSON.stringify(metadata || {}),
      ]
    );

    return row;
  } catch (error) {
    console.error("Project activity record error:", error);
    return null;
  }
}

export async function listUnreadNotifications(userId) {
  if (!userId) return [];

  let result;
  try {
    result = await query(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.body,
         n.entity_type,
         n.entity_id,
         n.metadata,
         n.created_at,
         p.id AS project_id,
         p.name AS project_name,
         p.color AS project_color,
         actor.id AS actor_id,
         actor.email AS actor_email,
         actor.full_name AS actor_full_name,
         actor.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN projects p ON p.id = n.project_id
       LEFT JOIN users actor ON actor.id = n.actor_user_id
       WHERE n.user_id = $1
         AND n.read_at IS NULL
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [userId]
    );
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return result.rows;
}

export async function markNotificationRead(notificationId, userId) {
  const result = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL
     RETURNING id`,
    [notificationId, userId]
  );

  return result.rows[0] || null;
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
       actor.email AS actor_email,
       actor.full_name AS actor_full_name,
       actor.avatar_url AS actor_avatar_url
     FROM project_activity pa
     JOIN project_members pm ON pm.project_id = pa.project_id AND pm.user_id = $2
     JOIN users actor ON actor.id = pa.actor_user_id
     WHERE pa.project_id = $1
     ORDER BY pa.created_at DESC
     LIMIT $3`,
    [projectId, userId, limit]
  );

  return result.rows;
}
