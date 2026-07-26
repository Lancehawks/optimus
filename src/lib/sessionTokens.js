import crypto from "node:crypto";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function generateSessionToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function serializeSessionExpiration(value) {
  const expiresAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new TypeError("Session expiration must be a valid date");
  }
  return expiresAt.toISOString();
}
