import crypto from "node:crypto";
import { hashSessionToken } from "./sessionTokens.js";

// Optimus accounts are created only by accepting an invitation. An invitation
// is a single-use bearer credential bound to one email address; the database
// stores only its SHA-256 hash.

export const INVITATION_TTL_DAYS = 7;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInvitationEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function generateInvitationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token) {
  return hashSessionToken(token);
}

export function isWellFormedInvitationToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function buildInvitationUrl(token, siteUrl = process.env.NEXT_PUBLIC_SITE_URL) {
  const url = new URL("/invite", siteUrl || "http://localhost:3000");
  url.searchParams.set("token", token);
  return url.toString();
}

export function invitationStatus(row, now = new Date()) {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at) <= now) return "expired";
  return "pending";
}

export function serializeInvitation(row) {
  return {
    id: row.id,
    email: row.email,
    status: invitationStatus(row),
    expiresAt: new Date(row.expires_at).toISOString(),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Issues a fresh invitation for an email. Earlier pending invitations for the
 * same address are revoked so only the newest link works.
 */
export async function issueInvitation(client, { email, invitedBy }) {
  const existingUser = await client.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingUser.rows.length > 0) {
    return { error: "already_member" };
  }

  await client.query(
    `UPDATE workspace_invitations
     SET revoked_at = NOW()
     WHERE email = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [email]
  );

  const token = generateInvitationToken();
  const result = await client.query(
    `INSERT INTO workspace_invitations (email, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'))
     RETURNING id, email, expires_at, accepted_at, revoked_at, created_at`,
    [email, hashInvitationToken(token), invitedBy || null, INVITATION_TTL_DAYS]
  );

  return { invitation: result.rows[0], token };
}

export async function findPendingInvitation(db, token) {
  if (!isWellFormedInvitationToken(token)) return null;
  const result = await db.query(
    `SELECT invitation.id, invitation.email, invitation.expires_at, inviter.full_name AS inviter_name
     FROM workspace_invitations invitation
     LEFT JOIN users inviter ON inviter.id = invitation.invited_by
     WHERE invitation.token_hash = $1
       AND invitation.accepted_at IS NULL
       AND invitation.revoked_at IS NULL
       AND invitation.expires_at > NOW()`,
    [hashInvitationToken(token)]
  );
  return result.rows[0] || null;
}

/**
 * Locks a pending invitation inside the caller's transaction so it can be
 * consumed exactly once.
 */
export async function lockPendingInvitation(client, token) {
  if (!isWellFormedInvitationToken(token)) return null;
  const result = await client.query(
    `SELECT id, email
     FROM workspace_invitations
     WHERE token_hash = $1
       AND accepted_at IS NULL
       AND revoked_at IS NULL
       AND expires_at > NOW()
     FOR UPDATE`,
    [hashInvitationToken(token)]
  );
  return result.rows[0] || null;
}

export async function markInvitationAccepted(client, invitationId, userId) {
  await client.query(
    `UPDATE workspace_invitations
     SET accepted_at = NOW(), accepted_user_id = $2
     WHERE id = $1`,
    [invitationId, userId]
  );
}
