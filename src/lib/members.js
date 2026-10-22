import { validTimeZone } from "./calendarTime.js";
import { normalizeInvitationEmail } from "./invitations.js";
import { hashPassword, passwordProblem } from "./passwords.js";

// Member administration. Admins see and change account-level details only:
// profile, role, sign-in access and assistant access, plus counts and usage.
// They never read a member's tasks, notes or other workspace content here.
//
// `db` has query(text, params) and transaction(callback), so routes pass the
// app pool, scripts pass their own pool, and tests pass PGlite.

export const MEMBER_ROLES = ["member", "admin"];
const NAME_MAX_LENGTH = 150;

export class MemberError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function startOfMonthUtc(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function cleanName(value) {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new MemberError("Full name is required");
  if (name.length > NAME_MAX_LENGTH) throw new MemberError(`Full name must be ${NAME_MAX_LENGTH} characters or less`);
  return name;
}

function cleanEmail(value) {
  const email = normalizeInvitationEmail(value);
  if (!email) throw new MemberError("Enter a valid email address");
  return email;
}

function cleanRole(value) {
  if (!MEMBER_ROLES.includes(value)) throw new MemberError("Role must be member or admin");
  return value;
}

function cleanTimeZone(value) {
  if (typeof value !== "string" || !validTimeZone(value)) throw new MemberError("Choose a valid timezone");
  return value;
}

function cleanPassword(value) {
  const problem = passwordProblem(value);
  if (problem) throw new MemberError(problem);
  return value;
}

function cleanBoolean(value, label) {
  if (typeof value !== "boolean") throw new MemberError(`${label} must be true or false`);
  return value;
}

async function emailTaken(db, email, exceptId = null) {
  const result = await db.query(
    "SELECT 1 FROM users WHERE LOWER(email) = $1 AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1",
    [email, exceptId]
  );
  return result.rows.length > 0;
}

function presentMember(row) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    timezone: row.timezone,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at || null,
    ai_assistant_enabled_at: row.ai_assistant_enabled_at || null,
    ai_assistant_enabled_by: row.ai_assistant_enabled_by_name || null,
    ai_calls_this_month: Number(row.ai_calls_this_month || 0),
    ai_cost_this_month: Number(row.ai_cost_this_month || 0),
  };
}

const MEMBER_SELECT = `
  SELECT u.id, u.email, u.full_name, u.avatar_url, u.timezone, u.role, u.is_active, u.created_at,
         u.ai_assistant_enabled_at, enabler.full_name AS ai_assistant_enabled_by_name,
         (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_sign_in_at,
         COALESCE(month_usage.calls, 0) AS ai_calls_this_month,
         COALESCE(month_usage.cost, 0) AS ai_cost_this_month
  FROM users u
  LEFT JOIN users enabler ON enabler.id = u.ai_assistant_enabled_by
  LEFT JOIN (
    SELECT user_id, COUNT(*)::int AS calls, SUM(cost_usd) AS cost
    FROM ai_usage
    WHERE created_at >= $1
    GROUP BY user_id
  ) month_usage ON month_usage.user_id = u.id`;

export async function listMembers(db, now = new Date()) {
  const result = await db.query(
    `${MEMBER_SELECT}
     ORDER BY u.is_active DESC, (u.role = 'admin') DESC, LOWER(u.full_name), u.id`,
    [startOfMonthUtc(now).toISOString()]
  );
  return result.rows.map(presentMember);
}

export async function getMember(db, id, now = new Date()) {
  const result = await db.query(`${MEMBER_SELECT} WHERE u.id = $2`, [startOfMonthUtc(now).toISOString(), id]);
  if (!result.rows[0]) return null;

  // Counts only: an admin sees how much someone uses Optimus, not what they wrote.
  const activity = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND is_archived = FALSE) AS tasks,
       (SELECT COUNT(*)::int FROM notes WHERE user_id = $1) AS notes,
       (SELECT COUNT(*)::int FROM project_members WHERE user_id = $1) AS projects,
       (SELECT COUNT(*)::int FROM events WHERE user_id = $1) AS events,
       (SELECT COUNT(*)::int FROM sessions WHERE user_id = $1 AND expires_at > NOW()) AS active_sessions,
       (SELECT COUNT(*)::int FROM ai_chats WHERE user_id = $1) AS conversations,
       (SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage WHERE user_id = $1) AS ai_cost_all_time`,
    [id]
  );
  const counts = activity.rows[0];
  return {
    ...presentMember(result.rows[0]),
    activity: {
      tasks: counts.tasks,
      notes: counts.notes,
      projects: counts.projects,
      events: counts.events,
      active_sessions: counts.active_sessions,
      conversations: counts.conversations,
    },
    ai_cost_all_time: Number(counts.ai_cost_all_time || 0),
  };
}

export async function createMember(db, input, { actorId = null } = {}) {
  const email = cleanEmail(input.email);
  const fullName = cleanName(input.fullName);
  const password = cleanPassword(input.password);
  const role = input.role === undefined ? "member" : cleanRole(input.role);
  const timeZone = input.timezone === undefined ? "UTC" : cleanTimeZone(input.timezone);
  const assistantEnabled = input.assistantEnabled === undefined ? false : cleanBoolean(input.assistantEnabled, "Assistant access");

  if (await emailTaken(db, email)) throw new MemberError("A member with this email already exists", 409);
  const passwordHash = await hashPassword(password);
  try {
    const result = await db.query(
      `INSERT INTO users
         (email, password_hash, full_name, timezone, role, ai_assistant_enabled_at, ai_assistant_enabled_by)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $6::boolean THEN NOW() END,
               CASE WHEN $6::boolean THEN $7::uuid END)
       RETURNING id`,
      [email, passwordHash, fullName, timeZone, role, assistantEnabled, actorId]
    );
    return result.rows[0].id;
  } catch (error) {
    if (error.code === "23505") throw new MemberError("A member with this email already exists", 409);
    throw error;
  }
}

// changes: { fullName, email, timezone, role, isActive, assistantEnabled, password }
export async function updateMember(db, id, changes, { actorId }) {
  const sets = [];
  const params = [id];
  const set = (sql, value) => {
    params.push(value);
    sets.push(sql.replace("?", `$${params.length}`));
  };

  if (changes.fullName !== undefined) set("full_name = ?", cleanName(changes.fullName));
  if (changes.timezone !== undefined) set("timezone = ?", cleanTimeZone(changes.timezone));
  const email = changes.email === undefined ? undefined : cleanEmail(changes.email);
  const role = changes.role === undefined ? undefined : cleanRole(changes.role);
  const isActive = changes.isActive === undefined ? undefined : cleanBoolean(changes.isActive, "Sign-in access");
  const assistantEnabled = changes.assistantEnabled === undefined
    ? undefined
    : cleanBoolean(changes.assistantEnabled, "Assistant access");
  const password = changes.password === undefined ? undefined : cleanPassword(changes.password);

  if (id === actorId && ((role !== undefined && role !== "admin") || isActive === false)) {
    throw new MemberError("You can't remove your own admin role or suspend yourself. Ask another admin.", 409);
  }

  const passwordHash = password === undefined ? undefined : await hashPassword(password);

  return db.transaction(async (client) => {
    // Lock every active admin so two admins can't demote each other at once
    // and leave the workspace without one.
    const admins = await client.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY id FOR UPDATE"
    );
    const current = await client.query("SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE", [id]);
    const member = current.rows[0];
    if (!member) throw new MemberError("Member not found", 404);

    const losesAdmin = member.role === "admin" && member.is_active
      && ((role !== undefined && role !== "admin") || isActive === false);
    if (losesAdmin && admins.rows.length <= 1) {
      throw new MemberError("Optimus needs at least one active admin. Make someone else an admin first.", 409);
    }

    if (email !== undefined) {
      if (await emailTaken(client, email, id)) throw new MemberError("A member with this email already exists", 409);
      set("email = ?", email);
    }
    if (role !== undefined) set("role = ?", role);
    if (isActive !== undefined) set("is_active = ?", isActive);
    if (passwordHash !== undefined) set("password_hash = ?", passwordHash);
    if (assistantEnabled === true) {
      set("ai_assistant_enabled_by = CASE WHEN ai_assistant_enabled_at IS NULL THEN ?::uuid ELSE ai_assistant_enabled_by END", actorId);
      sets.push("ai_assistant_enabled_at = COALESCE(ai_assistant_enabled_at, NOW())");
    } else if (assistantEnabled === false) {
      sets.push("ai_assistant_enabled_at = NULL", "ai_assistant_enabled_by = NULL");
    }

    if (sets.length > 0) {
      try {
        await client.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1`, params);
      } catch (error) {
        if (error.code === "23505") throw new MemberError("A member with this email already exists", 409);
        throw error;
      }
    }

    // A suspended member or a new password signs them out everywhere.
    if (isActive === false || passwordHash !== undefined) {
      await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    }
    if (passwordHash !== undefined) {
      await client.query("DELETE FROM password_resets WHERE user_id = $1", [id]);
    }
    return id;
  });
}

export function changedFields(changes) {
  return Object.keys(changes).filter((key) => changes[key] !== undefined).sort();
}
