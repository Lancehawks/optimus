import { query } from "@/lib/db";

export async function isProjectMember(userId, projectId) {
  if (!userId || !projectId) return false;

  const result = await query(
    `SELECT 1
     FROM project_members
     WHERE user_id = $1 AND project_id = $2
     LIMIT 1`,
    [userId, projectId]
  );

  return result.rows.length > 0;
}

export async function getProjectForMember(userId, projectId) {
  if (!userId || !projectId) return null;

  const result = await query(
    `SELECT p.*
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE p.id = $1 AND pm.user_id = $2
     LIMIT 1`,
    [projectId, userId]
  );

  return result.rows[0] || null;
}

export async function addProjectMemberByEmail(projectId, email) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!projectId || !normalizedEmail) return null;

  const result = await query(
    `WITH matched_user AS (
       SELECT id
       FROM users
       WHERE LOWER(email) = $2
       LIMIT 1
     )
     INSERT INTO project_members (project_id, user_id)
     SELECT $1, id
     FROM matched_user
     ON CONFLICT (project_id, user_id) DO NOTHING
     RETURNING user_id`,
    [projectId, normalizedEmail]
  );

  return result.rows[0] || null;
}

export async function createProjectInvitation(projectId, inviterUserId, inviteeUserId) {
  if (!projectId || !inviterUserId || !inviteeUserId) return null;

  const result = await query(
    `INSERT INTO project_invitations (project_id, inviter_user_id, invitee_user_id, status, created_at, responded_at)
     VALUES ($1, $2, $3, 'pending', NOW(), NULL)
     ON CONFLICT (project_id, invitee_user_id)
     DO UPDATE SET
       inviter_user_id = EXCLUDED.inviter_user_id,
       status = 'pending',
       created_at = NOW(),
       responded_at = NULL
     RETURNING *`,
    [projectId, inviterUserId, inviteeUserId]
  );

  return result.rows[0] || null;
}

export async function getUserByEmail(email) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const result = await query(
    `SELECT id, full_name, avatar_url
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  return result.rows[0] || null;
}

export async function listPendingProjectInvitations(userId) {
  if (!userId) return [];

  const result = await query(
    `SELECT
       pi.id,
       pi.created_at,
       p.id AS project_id,
       p.name AS project_name,
       p.description AS project_description,
       p.color AS project_color,
       inviter.id AS inviter_id,
       inviter.full_name AS inviter_full_name,
       inviter.avatar_url AS inviter_avatar_url
     FROM project_invitations pi
     JOIN projects p ON p.id = pi.project_id
     JOIN users inviter ON inviter.id = pi.inviter_user_id
     WHERE pi.invitee_user_id = $1
       AND pi.status = 'pending'
     ORDER BY pi.created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function listProjectMembers(projectId) {
  const result = await query(
    `SELECT u.id, u.full_name, u.avatar_url, pm.created_at
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.created_at ASC`,
    [projectId]
  );

  return result.rows;
}

export async function removeProjectMember(projectId, userId) {
  const result = await query(
    `DELETE FROM project_members
     WHERE project_id = $1 AND user_id = $2
     RETURNING user_id`,
    [projectId, userId]
  );

  return result.rows[0] || null;
}

export function projectScopedAccessCondition(alias) {
  return `(
    (${alias}.project_id IS NULL AND ${alias}.user_id = $1)
    OR
    (
      ${alias}.project_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = ${alias}.project_id
          AND pm.user_id = $1
      )
    )
  )`;
}
