import crypto from "node:crypto";

const MOBILE_STATE_PREFIX = "gom_";
const WEB_STATE_PREFIX = "gow_";
const MOBILE_RETURN_PATH = "/mobile/oauth/google";
const MOBILE_RESULT_STATUSES = new Set(["connected", "error"]);
const MOBILE_ERROR_REASONS = new Set([
  "access_denied",
  "connection_failed",
  "invalid_state",
  "oauth_error",
]);

export function generateGoogleOAuthState(clientType) {
  const prefix = clientType === "mobile" ? MOBILE_STATE_PREFIX : WEB_STATE_PREFIX;
  return `${prefix}${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashGoogleOAuthState(state) {
  return crypto.createHash("sha256").update(String(state)).digest("hex");
}

export function generateGooglePkce() {
  const codeVerifier = crypto.randomBytes(64).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function isMobileGoogleOAuthState(state) {
  return typeof state === "string" && state.startsWith(MOBILE_STATE_PREFIX);
}

export function isWebGoogleOAuthState(state) {
  return typeof state === "string" && state.startsWith(WEB_STATE_PREFIX);
}

function configuredMobileReturnUrl(configuredUrl = process.env.MOBILE_GOOGLE_OAUTH_RETURN_URL) {
  const value = typeof configuredUrl === "string" ? configuredUrl.trim() : "";
  if (!value) throw new Error("Mobile Google OAuth return URL is not configured");

  const url = new URL(value);
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.pathname !== MOBILE_RETURN_PATH
    || url.search
    || url.hash
  ) {
    throw new Error(
      `Mobile Google OAuth return URL must be an HTTPS URL ending at ${MOBILE_RETURN_PATH}`
    );
  }
  return url;
}

export function validateMobileGoogleOAuthReturnUrl(configuredUrl) {
  try {
    configuredMobileReturnUrl(configuredUrl);
    return true;
  } catch {
    return false;
  }
}

export function mobileGoogleOAuthResultUrl(
  status,
  reason,
  configuredUrl = process.env.MOBILE_GOOGLE_OAUTH_RETURN_URL
) {
  const url = configuredMobileReturnUrl(configuredUrl);
  const safeStatus = MOBILE_RESULT_STATUSES.has(status) ? status : "error";
  url.searchParams.set("status", safeStatus);

  if (safeStatus === "error") {
    url.searchParams.set(
      "reason",
      MOBILE_ERROR_REASONS.has(reason) ? reason : "connection_failed"
    );
  }
  return url;
}
