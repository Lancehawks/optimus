import {
  generateSessionToken,
  hashSessionToken,
  serializeSessionExpiration,
  SESSION_TTL_SECONDS,
} from "./sessionTokens.js";

export async function rotateSessionToken(client, currentToken) {
  const currentSession = await client.query(
    `SELECT s.id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND u.is_active = true
     FOR UPDATE OF s`,
    [hashSessionToken(currentToken)]
  );

  if (currentSession.rows.length === 0) return null;

  const nextToken = generateSessionToken();
  const result = await client.query(
    `UPDATE sessions
     SET token_hash = $1,
         expires_at = NOW() + ($2 * INTERVAL '1 second')
     WHERE id = $3
     RETURNING expires_at`,
    [hashSessionToken(nextToken), SESSION_TTL_SECONDS, currentSession.rows[0].id]
  );

  return {
    token: nextToken,
    expiresAt: serializeSessionExpiration(result.rows[0].expires_at),
  };
}
