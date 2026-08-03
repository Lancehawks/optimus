import { query } from "@/lib/db";
import {
  normalizeNotificationLimit,
  normalizeNotificationStatus,
  notificationPreferenceSqlClause,
} from "@/lib/notifications/notificationSql";

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

export async function createProjectActivityNotifications({
  projectId,
  actorUserId,
  activityId,
  entityType,
  entityId = null,
  title,
  body = null,
  metadata = {},
  db = query,
}) {
  await runQuery(
    db,
    `INSERT INTO notifications
       (user_id, actor_user_id, project_id, activity_id, type, entity_type, entity_id, title, body, metadata)
     SELECT pm.user_id, $2, $1, $3, 'project_activity', $4, $5, $6, $7, $8::jsonb
     FROM project_members pm
     WHERE pm.project_id = $1
       AND pm.user_id <> $2
       AND NOT EXISTS (
         SELECT 1
         FROM notifications existing
         WHERE existing.user_id = pm.user_id
           AND existing.actor_user_id = $2
           AND existing.project_id = $1
           AND existing.type = 'project_activity'
           AND existing.entity_type = $4
           AND existing.entity_id IS NOT DISTINCT FROM $5
           AND existing.title = $6
           AND COALESCE(existing.body, '') = COALESCE($7, '')
           AND existing.created_at > NOW() - INTERVAL '10 minutes'
       )`,
    [
      projectId,
      actorUserId,
      activityId,
      entityType,
      entityId,
      title,
      body,
      JSON.stringify(metadata || {}),
    ]
  );
}

export async function createProjectInvitationNotification({
  invitationId,
  projectId,
  inviterUserId,
  inviteeUserId,
}) {
  if (!invitationId || !projectId || !inviterUserId || !inviteeUserId) {
    return null;
  }

  const result = await query(
    `WITH updated_notification AS (
       UPDATE notifications
       SET actor_user_id = $3,
           project_id = $2,
           title = 'invited you to collaborate',
           body = 'Project invitation',
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object('invitation_id', $1::uuid, 'status', 'pending'),
           read_at = NULL,
           created_at = NOW()
       WHERE user_id = $4
         AND type = 'project_invitation'
         AND entity_type = 'project_invitation'
         AND entity_id = $1
       RETURNING id
     ),
     inserted_notification AS (
       INSERT INTO notifications
         (user_id, actor_user_id, project_id, activity_id, type, entity_type, entity_id, title, body, metadata)
       SELECT $4, $3, $2, NULL, 'project_invitation', 'project_invitation', $1,
              'invited you to collaborate', 'Project invitation',
              jsonb_build_object('invitation_id', $1::uuid, 'status', 'pending')
       WHERE NOT EXISTS (SELECT 1 FROM updated_notification)
         AND NOT EXISTS (
           SELECT 1
           FROM notifications
           WHERE user_id = $4
             AND type = 'project_invitation'
             AND entity_type = 'project_invitation'
             AND entity_id = $1
         )
       ON CONFLICT DO NOTHING
       RETURNING id
     )
     SELECT id FROM updated_notification
     UNION ALL
     SELECT id FROM inserted_notification
     LIMIT 1`,
    [invitationId, projectId, inviterUserId, inviteeUserId]
  );

  return result.rows[0] || null;
}

export async function updateProjectInvitationNotification({
  invitationId,
  inviteeUserId,
  status,
}) {
  if (!invitationId || !inviteeUserId || !["accepted", "declined"].includes(status)) {
    return null;
  }

  const result = await query(
    `UPDATE notifications
     SET metadata = COALESCE(metadata, '{}'::jsonb)
         || jsonb_build_object(
           'invitation_id', $1::uuid,
           'status', $3::text,
           'responded_at', NOW()
         ),
         read_at = COALESCE(read_at, NOW())
     WHERE user_id = $2
       AND type = 'project_invitation'
       AND entity_type = 'project_invitation'
       AND entity_id = $1
     RETURNING id`,
    [invitationId, inviteeUserId, status]
  );

  return result.rows[0] || null;
}

export async function listUnreadNotifications(
  userId,
  {
    preferences,
    limit = 30,
    cursor = null,
    includeLookahead = false,
  } = {}
) {
  if (!userId) return [];

  const safeLimit = normalizeNotificationLimit(limit, 30);
  const preferenceClause = notificationPreferenceSqlClause("n", preferences);
  const cursorClause = cursor
    ? "AND (n.created_at, n.id) < ($2::timestamptz, $3::uuid)"
    : "";
  const queryLimit = includeLookahead ? safeLimit + 1 : safeLimit;
  const params = cursor
    ? [userId, cursor.createdAt, cursor.id, queryLimit]
    : [userId, queryLimit];
  const limitParameter = cursor ? "$4" : "$2";

  try {
    const result = await query(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.body,
         n.entity_type,
         n.entity_id,
         n.metadata,
         n.read_at,
         n.created_at,
         p.id AS project_id,
         p.name AS project_name,
         p.color AS project_color,
         actor.id AS actor_id,
         actor.full_name AS actor_full_name,
         actor.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN projects p ON p.id = n.project_id
       LEFT JOIN users actor ON actor.id = n.actor_user_id
       WHERE n.user_id = $1
         AND n.read_at IS NULL
         ${preferenceClause}
         ${cursorClause}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ${limitParameter}`,
      params
    );

    return result.rows;
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
}

export async function listNotifications(
  userId,
  {
    status = "all",
    limit = 50,
    preferences,
    cursor = null,
    includeLookahead = false,
  } = {}
) {
  if (!userId) return [];

  const normalizedStatus = normalizeNotificationStatus(status);
  const safeLimit = normalizeNotificationLimit(limit, 50);
  const preferenceClause = notificationPreferenceSqlClause("n", preferences);
  const statusClause = normalizedStatus === "read"
    ? "AND n.read_at IS NOT NULL"
    : normalizedStatus === "unread"
      ? "AND n.read_at IS NULL"
      : "";
  const cursorClause = cursor
    ? "AND (n.created_at, n.id) < ($2::timestamptz, $3::uuid)"
    : "";
  const queryLimit = includeLookahead ? safeLimit + 1 : safeLimit;
  const params = cursor
    ? [userId, cursor.createdAt, cursor.id, queryLimit]
    : [userId, queryLimit];
  const limitParameter = cursor ? "$4" : "$2";

  try {
    const result = await query(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.body,
         n.entity_type,
         n.entity_id,
         n.metadata,
         n.read_at,
         n.created_at,
         p.id AS project_id,
         p.name AS project_name,
         p.color AS project_color,
         actor.id AS actor_id,
         actor.full_name AS actor_full_name,
         actor.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN projects p ON p.id = n.project_id
       LEFT JOIN users actor ON actor.id = n.actor_user_id
       WHERE n.user_id = $1
         ${statusClause}
         ${preferenceClause}
         ${cursorClause}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ${limitParameter}`,
      params
    );

    return result.rows;
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
}

export async function countUnreadNotifications(userId, preferences) {
  if (!userId) return 0;

  const preferenceClause = notificationPreferenceSqlClause("n", preferences);

  try {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM notifications n
       WHERE n.user_id = $1
         AND n.read_at IS NULL
         ${preferenceClause}`,
      [userId]
    );

    return result.rows[0]?.count || 0;
  } catch (error) {
    if (error.code === "42P01") return 0;
    throw error;
  }
}

export async function markNotificationsRead(notificationIds, userId) {
  if (!userId || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return [];
  }

  const ids = [...new Set(notificationIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const result = await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
     RETURNING id`,
    [userId, ids]
  );

  return result.rows;
}

export async function markNotificationRead(notificationId, userId) {
  const result = await query(
    `UPDATE notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );

  return result.rows[0] || null;
}
