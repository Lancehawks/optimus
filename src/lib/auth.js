import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { query } from "./db";

const COOKIE_NAME = "optimus_token";
const TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getRequiredJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

const JWT_SECRET = getRequiredJwtSecret();

function runQuery(db, text, params) {
  return typeof db === "function" ? db(text, params) : db.query(text, params);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function getRequestIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export function getRequestDeviceInfo(request) {
  return request.headers.get("user-agent")?.substring(0, 255) || null;
}

export async function createSession(user, request, db = query) {
  const token = generateToken(user);
  const deviceInfo = request ? getRequestDeviceInfo(request) : null;
  const ipAddress = request ? getRequestIp(request) : null;

  await runQuery(
    db,
    `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
    [user.id, token, deviceInfo, ipAddress]
  );

  return token;
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
  try {
    let token;

    if (request) {
      // From request object (API routes)
      token = request.cookies.get(COOKIE_NAME)?.value;
    } else {
      // From cookies() (server components)
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    }

    if (!token) return null;

    const decoded = verifyToken(token);
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, u.timezone, u.preferences, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.user_id = $2
         AND s.expires_at > NOW()
         AND u.is_active = true
       LIMIT 1`,
      [token, decoded.userId]
    );

    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  return request?.cookies.get(COOKIE_NAME)?.value || null;
}
