import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "./db";
import { getRequestSessionToken, isMobileApiRequest } from "./authRequest";
import {
  generateSessionToken,
  hashSessionToken,
  serializeSessionExpiration,
  SESSION_TTL_SECONDS,
} from "./sessionTokens";

export { isMobileApiRequest } from "./authRequest";

const COOKIE_NAME = "optimus_token";
const COOKIE_MAX_AGE = SESSION_TTL_SECONDS;

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken() {
  return generateSessionToken();
}

export function hashToken(token) {
  return hashSessionToken(token);
}

export function getRequestIp(request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export function getRequestDeviceInfo(request) {
  return request.headers.get("user-agent")?.substring(0, 255) || null;
}

export async function createSession(user, request, db = query) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const deviceInfo = request ? getRequestDeviceInfo(request) : null;
  const ipAddress = request ? getRequestIp(request) : null;

  await runQuery(db, "DELETE FROM sessions WHERE user_id = $1 AND expires_at <= NOW()", [user.id]);
  const result = await runQuery(
    db,
    `INSERT INTO sessions (user_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 second'))
     RETURNING expires_at`,
    [user.id, tokenHash, deviceInfo, ipAddress, SESSION_TTL_SECONDS]
  );

  return {
    token,
    expiresAt: serializeSessionExpiration(result.rows[0].expires_at),
  };
}

export async function setAuthCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getAuthUser(request) {
  let token;

  if (request) {
    token = getTokenFromRequest(request);
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) return null;

  const tokenHash = hashToken(token);
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.avatar_url, u.timezone, u.preferences, u.is_active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND u.is_active = true
     LIMIT 1`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

export function getTokenFromRequest(request) {
  return getRequestSessionToken(request, COOKIE_NAME);
}
