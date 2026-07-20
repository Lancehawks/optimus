const MOBILE_CLIENT_HEADER = "x-optimus-client";

export function getRequestSessionToken(request, cookieName) {
  const authorization = request?.headers?.get("authorization")?.trim();
  if (authorization) {
    const [scheme, ...tokenParts] = authorization.split(/\s+/);
    const bearerToken = tokenParts.join(" ").trim();
    if (scheme?.toLowerCase() === "bearer" && bearerToken) {
      return bearerToken;
    }
  }

  return request?.cookies?.get(cookieName)?.value || null;
}

export function isMobileApiRequest(request) {
  return request?.headers?.get(MOBILE_CLIENT_HEADER)?.toLowerCase() === "mobile";
}
