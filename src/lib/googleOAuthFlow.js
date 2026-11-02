import { transaction } from "@/lib/db";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secretEncryption";
import {
  generateGoogleOAuthState,
  generateGooglePkce,
  hashGoogleOAuthState,
} from "@/lib/googleOAuthPrimitives";
import { hashSessionToken } from "./sessionTokens.js";

const GOOGLE_OAUTH_FLOW_TTL_SECONDS = 10 * 60;

function validClientType(clientType) {
  return clientType === "web" || clientType === "mobile";
}

function expirationISOString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("OAuth flow expiration is invalid");
  return date.toISOString();
}

export async function createGoogleOAuthFlow(userId, clientType, sessionToken) {
  if (!userId || !validClientType(clientType) || !sessionToken) {
    throw new TypeError("A user, session, and supported OAuth client type are required");
  }

  const state = generateGoogleOAuthState(clientType);
  const { codeVerifier, codeChallenge } = generateGooglePkce();
  const stateHash = hashGoogleOAuthState(state);
  const verifierCiphertext = encryptSecret(codeVerifier);

  const expiresAt = await transaction(async (client) => {
    const session = await client.query(
      `SELECT auth_session.id
       FROM sessions auth_session
       JOIN users user_account ON user_account.id = auth_session.user_id
       WHERE auth_session.user_id = $1
         AND auth_session.token_hash = $2
         AND auth_session.expires_at > NOW()
         AND user_account.is_active = TRUE
       FOR UPDATE OF auth_session, user_account`,
      [userId, hashSessionToken(sessionToken)]
    );
    if (!session.rows[0]) return null;

    await client.query(
      `DELETE FROM google_oauth_flows
       WHERE id IN (
         SELECT id
         FROM google_oauth_flows
         WHERE COALESCE(consumed_at, expires_at) < NOW() - INTERVAL '1 day'
         ORDER BY COALESCE(consumed_at, expires_at)
         LIMIT 500
       )`
    );
    await client.query(
      `UPDATE google_oauth_flows
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND client_type = $2
         AND consumed_at IS NULL`,
      [userId, clientType]
    );
    const result = await client.query(
      `INSERT INTO google_oauth_flows
         (user_id, session_id, client_type, state_hash, code_verifier_ciphertext, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))
       RETURNING expires_at`,
      [
        userId,
        session.rows[0].id,
        clientType,
        stateHash,
        verifierCiphertext,
        GOOGLE_OAUTH_FLOW_TTL_SECONDS,
      ]
    );
    return expirationISOString(result.rows[0].expires_at);
  });

  if (!expiresAt) return null;
  return { state, codeChallenge, expiresAt };
}

export async function consumeGoogleOAuthFlow({
  state,
  clientType,
  expectedUserId = null,
}) {
  if (
    typeof state !== "string"
    || state.length < 40
    || state.length > 200
    || !validClientType(clientType)
  ) {
    return null;
  }

  const flow = await transaction(async (client) => {
    const result = await client.query(
      `SELECT flow.id, flow.user_id, flow.code_verifier_ciphertext
       FROM google_oauth_flows flow
       JOIN users user_account ON user_account.id = flow.user_id
       JOIN sessions initiating_session
         ON initiating_session.id = flow.session_id
        AND initiating_session.user_id = flow.user_id
       WHERE flow.state_hash = $1
         AND flow.client_type = $2
         AND flow.consumed_at IS NULL
         AND flow.expires_at > NOW()
         AND user_account.is_active = TRUE
         AND initiating_session.expires_at > NOW()
         AND ($3::uuid IS NULL OR flow.user_id = $3::uuid)
       FOR UPDATE OF flow`,
      [hashGoogleOAuthState(state), clientType, expectedUserId]
    );
    if (!result.rows[0]) return null;

    const consumed = await client.query(
      `UPDATE google_oauth_flows
       SET consumed_at = NOW()
       WHERE id = $1 AND consumed_at IS NULL
       RETURNING user_id, code_verifier_ciphertext`,
      [result.rows[0].id]
    );
    return consumed.rows[0] || null;
  });

  if (!flow || !isEncryptedSecret(flow.code_verifier_ciphertext)) return null;
  return {
    userId: flow.user_id,
    codeVerifier: decryptSecret(flow.code_verifier_ciphertext),
  };
}
