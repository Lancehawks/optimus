import crypto from "node:crypto";

export const FOUNDER_ACCESS_TTL_SECONDS = 4 * 60 * 60;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionBinding(sessionToken) {
  return crypto.createHash("sha256").update(String(sessionToken)).digest("base64url");
}

function signPayload(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function verifyFounderPin(pin, expectedPin) {
  if (typeof pin !== "string" || typeof expectedPin !== "string" || !expectedPin) {
    return false;
  }

  const suppliedHash = crypto.createHash("sha256").update(pin).digest();
  const expectedHash = crypto.createHash("sha256").update(expectedPin).digest();
  return crypto.timingSafeEqual(suppliedHash, expectedHash);
}

export function createFounderAccessToken({
  userId,
  sessionToken,
  secret,
  now = Date.now(),
  ttlSeconds = FOUNDER_ACCESS_TTL_SECONDS,
}) {
  if (!userId || !sessionToken || !secret) {
    throw new Error("Founder access token requires a user, session, and signing secret.");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    subject: userId,
    session: sessionBinding(sessionToken),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  })).toString("base64url");

  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyFounderAccessToken(token, {
  userId,
  sessionToken,
  secret,
  now = Date.now(),
} = {}) {
  if (!token || !userId || !sessionToken || !secret) return false;

  const [payload, signature, extra] = String(token).split(".");
  if (!payload || !signature || extra || !safeEqual(signature, signPayload(payload, secret))) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const currentTime = Math.floor(now / 1000);
    return decoded.version === 1
      && decoded.subject === userId
      && safeEqual(decoded.session, sessionBinding(sessionToken))
      && Number.isInteger(decoded.issuedAt)
      && decoded.issuedAt <= currentTime + 60
      && Number.isInteger(decoded.expiresAt)
      && decoded.expiresAt > currentTime;
  } catch {
    return false;
  }
}
