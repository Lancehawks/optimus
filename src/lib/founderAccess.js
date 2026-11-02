import { cookies } from "next/headers";
import {
  createFounderAccessToken,
  FOUNDER_ACCESS_TTL_SECONDS,
  verifyFounderAccessToken,
} from "./founderAccessToken";

const AUTH_COOKIE_NAME = "optimus_token";
const FOUNDER_COOKIE_NAME = "optimus_founder_access";

function getSigningSecret() {
  const secret = process.env.FOUNDER_LOBBY_ACCESS_SECRET
    || process.env.JWT_SECRET
    || process.env.TOKEN_ENCRYPTION_KEY;

  if (!secret || secret.length < 32) {
    throw new Error("Founder Lobby requires a signing secret of at least 32 characters.");
  }

  return secret;
}

export function getConfiguredFounderPin() {
  const pin = process.env.FOUNDER_LOBBY_PIN?.trim();
  if (!pin) throw new Error("FOUNDER_LOBBY_PIN is not configured.");
  return pin;
}

export async function hasFounderAccess(userId) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const founderToken = cookieStore.get(FOUNDER_COOKIE_NAME)?.value;

  if (!sessionToken || !founderToken) return false;

  return verifyFounderAccessToken(founderToken, {
    userId,
    sessionToken,
    secret: getSigningSecret(),
  });
}

export async function grantFounderAccess(userId, sessionToken) {
  const cookieStore = await cookies();
  const token = createFounderAccessToken({
    userId,
    sessionToken,
    secret: getSigningSecret(),
  });

  cookieStore.set(FOUNDER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: FOUNDER_ACCESS_TTL_SECONDS,
    path: "/",
  });
}

export async function clearFounderAccess() {
  const cookieStore = await cookies();
  cookieStore.set(FOUNDER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
