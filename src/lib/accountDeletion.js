import bcrypt from "bcryptjs";
import { transaction } from "@/lib/db";

export async function permanentlyDeleteAccount(userId, currentPassword) {
  return transaction(async (client) => {
    const account = await client.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1 AND is_active = TRUE
       FOR UPDATE`,
      [userId]
    );
    if (!account.rows[0]) return { deleted: false, reason: "unavailable" };

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      account.rows[0].password_hash
    );
    if (!passwordMatches) {
      return { deleted: false, reason: "password" };
    }

    // Serialize ownership changes with project deletion/member changes. An
    // owned project is transferred to its longest-standing active member.
    await client.query(
      `SELECT project.id
       FROM projects project
       WHERE project.user_id = $1
       ORDER BY project.id
       FOR UPDATE`,
      [userId]
    );
    await client.query(
      `WITH successor AS (
         SELECT DISTINCT ON (project.id)
           project.id AS project_id,
           member.user_id AS successor_user_id
         FROM projects project
         JOIN project_members member ON member.project_id = project.id
         JOIN users candidate
           ON candidate.id = member.user_id
          AND candidate.is_active = TRUE
         WHERE project.user_id = $1
           AND member.user_id <> $1
         ORDER BY project.id, member.created_at, member.user_id
       )
       UPDATE projects project
       SET user_id = successor.successor_user_id,
           updated_at = NOW()
       FROM successor
       WHERE project.id = successor.project_id`,
      [userId]
    );

    // Projects without another active member are private to the deleting
    // account and are removed. Project foreign keys apply their documented
    // cascade/SET NULL semantics before private rows are deleted below.
    await client.query("DELETE FROM projects WHERE user_id = $1", [userId]);

    // Shared contributions survive under the project's current owner. This
    // prevents a user's account deletion from destroying collaborators' work.
    await client.query(
      `UPDATE tasks item
       SET user_id = project.user_id,
           updated_at = NOW()
       FROM projects project
       WHERE item.user_id = $1
         AND item.project_id = project.id`,
      [userId]
    );
    await client.query(
      `UPDATE notes item
       SET user_id = project.user_id,
           updated_at = NOW()
       FROM projects project
       WHERE item.user_id = $1
         AND item.project_id = project.id`,
      [userId]
    );
    await client.query(
      `UPDATE whiteboards item
       SET user_id = project.user_id,
           updated_at = NOW()
       FROM projects project
       WHERE item.user_id = $1
         AND item.project_id = project.id`,
      [userId]
    );
    await client.query(
      `UPDATE reading_list item
       SET user_id = project.user_id,
           updated_at = NOW()
       FROM projects project
       WHERE item.user_id = $1
         AND item.project_id = project.id`,
      [userId]
    );
    await client.query(
      `UPDATE tasks child
       SET parent_task_id = NULL,
           updated_at = NOW()
       FROM tasks parent
       WHERE child.parent_task_id = parent.id
         AND child.project_id IS NOT NULL
         AND child.user_id <> $1
         AND parent.user_id = $1`,
      [userId]
    );

    // Shared events need a calendar owned by the successor. Every normal
    // account has one; this insert repairs legacy accounts that do not.
    await client.query(
      `INSERT INTO calendars (user_id, name, color, is_default)
       SELECT owner.user_id, 'Calendar', '#0d6b88', TRUE
       FROM (
         SELECT DISTINCT project.user_id
         FROM events event
         JOIN projects project ON project.id = event.project_id
         WHERE event.user_id = $1
       ) owner
       WHERE NOT EXISTS (
         SELECT 1 FROM calendars existing
         WHERE existing.user_id = owner.user_id
       )
       ON CONFLICT DO NOTHING`,
      [userId]
    );
    await client.query(
      `WITH target_calendar AS (
         SELECT DISTINCT ON (calendar.user_id)
           calendar.user_id,
           calendar.id
         FROM calendars calendar
         ORDER BY
           calendar.user_id,
           calendar.is_default DESC,
           calendar.created_at,
           calendar.id
       )
       UPDATE events event
       SET user_id = project.user_id,
           calendar_id = target_calendar.id,
           google_event_id = NULL,
           synced_at = NULL,
           source_key = NULL,
           updated_at = NOW()
       FROM projects project
       JOIN target_calendar ON target_calendar.user_id = project.user_id
       WHERE event.user_id = $1
         AND event.project_id = project.id`,
      [userId]
    );

    // Explicitly sever every credential path before removing the account.
    // The final user deletion also cascades through all remaining personal
    // data, including password resets.
    await client.query("DELETE FROM google_connections WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM google_oauth_flows WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

    const deleted = await client.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [userId]
    );
    return {
      deleted: Boolean(deleted.rows[0]),
      reason: deleted.rows[0] ? null : "unavailable",
    };
  });
}
