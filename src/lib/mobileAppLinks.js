import { validateMobileGoogleOAuthReturnUrl } from "./googleOAuthPrimitives.js";

export const MOBILE_GOOGLE_OAUTH_APP_LINK_PATH = "/mobile/oauth/google";
export const MOBILE_GOOGLE_OAUTH_APP_LINK_PATTERN =
  `${MOBILE_GOOGLE_OAUTH_APP_LINK_PATH}*`;

const APPLE_TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const APP_IDENTIFIER_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const ANDROID_PACKAGE_SEGMENT = /^[A-Za-z][A-Za-z0-9_]*$/;
const ANDROID_SHA256_FINGERPRINT_PATTERN =
  /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/;
const MAX_ANDROID_FINGERPRINTS = 20;

function requiredValue(value, name) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${name} is not configured`);
  return normalized;
}
function isReverseDnsIdentifier(value, segmentPattern) {
  if (value.length > 255 || value.includes("*")) return false;
  const segments = value.split(".");
  return segments.length >= 2 && segments.every((segment) => segmentPattern.test(segment));
}

export function appleAppSiteAssociation(environment = process.env) {
  const teamId = requiredValue(
    environment.MOBILE_APPLE_TEAM_ID,
    "MOBILE_APPLE_TEAM_ID"
  );
  const bundleId = requiredValue(
    environment.MOBILE_IOS_BUNDLE_ID,
    "MOBILE_IOS_BUNDLE_ID"
  );

  if (!APPLE_TEAM_ID_PATTERN.test(teamId)) {
    throw new Error("MOBILE_APPLE_TEAM_ID must be a 10-character Apple Team ID");
  }
  if (!isReverseDnsIdentifier(bundleId, APP_IDENTIFIER_SEGMENT)) {
    throw new Error("MOBILE_IOS_BUNDLE_ID must be an exact reverse-DNS bundle ID");
  }

  return {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          paths: [MOBILE_GOOGLE_OAUTH_APP_LINK_PATTERN],
        },
      ],
    },
  };
}

export function androidAssetLinks(environment = process.env) {
  const packageName = requiredValue(
    environment.MOBILE_ANDROID_PACKAGE_NAME,
    "MOBILE_ANDROID_PACKAGE_NAME"
  );
  const configuredFingerprints = requiredValue(
    environment.MOBILE_ANDROID_SHA256_FINGERPRINTS,
    "MOBILE_ANDROID_SHA256_FINGERPRINTS"
  );

  if (!isReverseDnsIdentifier(packageName, ANDROID_PACKAGE_SEGMENT)) {
    throw new Error(
      "MOBILE_ANDROID_PACKAGE_NAME must be an exact reverse-DNS package name"
    );
  }

  const fingerprints = [
    ...new Set(
      configuredFingerprints
        .split(",")
        .map((fingerprint) => fingerprint.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (
    fingerprints.length === 0
    || fingerprints.length > MAX_ANDROID_FINGERPRINTS
    || fingerprints.some(
      (fingerprint) => !ANDROID_SHA256_FINGERPRINT_PATTERN.test(fingerprint)
    )
  ) {
    throw new Error(
      "MOBILE_ANDROID_SHA256_FINGERPRINTS must contain valid SHA-256 certificate fingerprints"
    );
  }

  const relation = "delegate_permission/common.handle_all_urls";
  return [
    {
      relation: [relation],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
      relation_extensions: {
        [relation]: {
          dynamic_app_link_components: [
            { "/": MOBILE_GOOGLE_OAUTH_APP_LINK_PATTERN },
            { "/": "*", exclude: true },
          ],
        },
      },
    },
  ];
}

export function validateAppleAppSiteAssociation(environment = process.env) {
  try {
    appleAppSiteAssociation(environment);
    return true;
  } catch {
    return false;
  }
}

export function validateAndroidAssetLinks(environment = process.env) {
  try {
    androidAssetLinks(environment);
    return true;
  } catch {
    return false;
  }
}

export function validateMobileAppLinkOrigin(environment = process.env) {
  const returnUrl = typeof environment.MOBILE_GOOGLE_OAUTH_RETURN_URL === "string"
    ? environment.MOBILE_GOOGLE_OAUTH_RETURN_URL.trim()
    : "";
  const publicUrl = typeof environment.NEXT_PUBLIC_SITE_URL === "string"
    ? environment.NEXT_PUBLIC_SITE_URL.trim()
    : "";

  if (!validateMobileGoogleOAuthReturnUrl(returnUrl) || !publicUrl) return false;

  try {
    const target = new URL(returnUrl);
    const site = new URL(publicUrl);
    return (
      site.protocol === "https:"
      && !site.username
      && !site.password
      && site.pathname === "/"
      && !site.search
      && !site.hash
      && site.origin === target.origin
    );
  } catch {
    return false;
  }
}
