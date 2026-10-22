import { PROVIDERS } from "../ai/models.js";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../secretEncryption.js";

// Members' own provider keys. Keys are encrypted with AES-256-GCM under
// TOKEN_ENCRYPTION_KEY before they reach the database, decrypted only on the
// server for the request that uses them, and only a short hint is ever shown
// again. `db` has query(text, params).

export class KeyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function requireProvider(provider) {
  if (!Object.hasOwn(PROVIDERS, provider)) throw new KeyError("Unknown provider", 404);
  return PROVIDERS[provider];
}

export function cleanApiKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) throw new KeyError("Paste your API key");
  if (/\s/.test(key) || key.length < 20 || key.length > 512 || key.startsWith("enc:")) {
    throw new KeyError("That doesn't look like an API key");
  }
  return key;
}

// The non-secret prefix (like "sk-ant-") and the last four characters.
export function keyHint(apiKey) {
  const prefix = apiKey.match(/^[a-z]{2,4}-[a-z]{2,4}-/i)?.[0] || "";
  return `${prefix}…${apiKey.slice(-4)}`;
}

export async function listKeys(db, userId) {
  const result = await db.query(
    "SELECT provider, key_hint, created_at, updated_at FROM ai_provider_keys WHERE user_id = $1 ORDER BY provider",
    [userId]
  );
  return result.rows;
}

export async function keyProviders(db, userId) {
  return new Set((await listKeys(db, userId)).map((row) => row.provider));
}

export async function saveKey(db, userId, provider, apiKey) {
  requireProvider(provider);
  const hint = keyHint(apiKey);
  const result = await db.query(
    `INSERT INTO ai_provider_keys (user_id, provider, encrypted_key, key_hint)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, key_hint = EXCLUDED.key_hint
     RETURNING provider, key_hint, created_at, updated_at`,
    [userId, provider, encryptSecret(apiKey), hint]
  );
  return result.rows[0];
}

export async function deleteKey(db, userId, provider) {
  requireProvider(provider);
  const result = await db.query(
    "DELETE FROM ai_provider_keys WHERE user_id = $1 AND provider = $2 RETURNING provider",
    [userId, provider]
  );
  return result.rows.length > 0;
}

// Plaintext for one request; never returned to a client or logged.
export async function loadKey(db, userId, provider) {
  const result = await db.query(
    "SELECT encrypted_key FROM ai_provider_keys WHERE user_id = $1 AND provider = $2",
    [userId, provider]
  );
  const stored = result.rows[0]?.encrypted_key;
  if (!stored) return null;
  if (!isEncryptedSecret(stored)) throw new Error("Stored provider key is not encrypted");
  return decryptSecret(stored);
}
