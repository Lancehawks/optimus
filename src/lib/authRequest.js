const MOBILE_CLIENT_HEADER = "x-optimus-client";

export function getBearerTokenFromRequest(request) {
  const authorization = request?.headers?.get("authorization")?.trim();
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || null;
}

export function getRequestSessionToken(request, cookieName) {
  return getBearerTokenFromRequest(request) || request?.cookies?.get(cookieName)?.value || null;
}

export function isMobileApiRequest(request) {
  return request?.headers?.get(MOBILE_CLIENT_HEADER)?.toLowerCase() === "mobile";
}

export function getMobileSessionCredentials(request, session) {
  if (!isMobileApiRequest(request)) return {};

  return {
    token: session.token,
    expiresAt: session.expiresAt,
  };
}
