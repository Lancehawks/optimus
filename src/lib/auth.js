import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "optimus_token";
const TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

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
      "SELECT id, email, full_name, avatar_url, timezone, preferences, is_active FROM users WHERE id = $1 AND is_active = true",
      [decoded.userId]
    );

    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}
