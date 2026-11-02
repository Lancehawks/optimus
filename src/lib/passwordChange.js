import bcrypt from "bcryptjs";
import { transaction } from "@/lib/db";
import { hashSessionToken } from "@/lib/sessionTokens";

export async function changePasswordAndRevokeOtherSessions({
  userId,
  currentSessionToken,
  currentPassword,
  newPassword,
}) {
  return transaction(async (client) => {
    const current = await client.query(
      `SELECT account.password_hash, auth_session.id AS session_id
       FROM users account
       JOIN sessions auth_session ON auth_session.user_id = account.id
       WHERE account.id = $1
         AND account.is_active = TRUE
         AND auth_session.token_hash = $2
         AND auth_session.expires_at > NOW()
       FOR UPDATE OF account, auth_session`,
      [userId, hashSessionToken(currentSessionToken)]
    );
    if (!current.rows[0]) return { changed: false, reason: "session" };

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      current.rows[0].password_hash
    );
    if (!passwordMatches) return { changed: false, reason: "password" };

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );
    await client.query(
      `DELETE FROM sessions
       WHERE user_id = $1
         AND id <> $2`,
      [userId, current.rows[0].session_id]
    );

    return { changed: true, reason: null };
  });
}
