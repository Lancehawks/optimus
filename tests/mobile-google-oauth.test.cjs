const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Google OAuth state is opaque and PKCE uses an RFC 7636 S256 challenge", async () => {
  const oauth = await import(
    pathToFileURL(path.join(root, "src/lib/googleOAuthPrimitives.js"))
  );
  const mobileState = oauth.generateGoogleOAuthState("mobile");
  const webState = oauth.generateGoogleOAuthState("web");
  const secondMobileState = oauth.generateGoogleOAuthState("mobile");
  const pkce = oauth.generateGooglePkce();

  assert.match(mobileState, /^gom_[A-Za-z0-9_-]{43}$/);
  assert.match(webState, /^gow_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(mobileState, secondMobileState);
  assert.equal(oauth.isMobileGoogleOAuthState(mobileState), true);
  assert.equal(oauth.isMobileGoogleOAuthState(webState), false);
  assert.match(oauth.hashGoogleOAuthState(mobileState), /^[a-f0-9]{64}$/);
  assert.notEqual(oauth.hashGoogleOAuthState(mobileState), mobileState);
  assert.ok(pkce.codeVerifier.length >= 43 && pkce.codeVerifier.length <= 128);
  assert.equal(
    pkce.codeChallenge,
    crypto.createHash("sha256").update(pkce.codeVerifier).digest("base64url")
  );
});

test("mobile completion redirects only to the configured fixed HTTPS App Link", async () => {
  const oauth = await import(
    pathToFileURL(path.join(root, "src/lib/googleOAuthPrimitives.js"))
  );
  const configured = "https://app.optimus.example/mobile/oauth/google";

  assert.equal(oauth.validateMobileGoogleOAuthReturnUrl(configured), true);
  assert.equal(
    oauth.mobileGoogleOAuthResultUrl("connected", null, configured).toString(),
    `${configured}?status=connected`
  );
  assert.equal(
    oauth.mobileGoogleOAuthResultUrl("error", "invalid_state", configured).toString(),
    `${configured}?status=error&reason=invalid_state`
  );
  assert.equal(
    oauth.mobileGoogleOAuthResultUrl("error", "attacker-controlled", configured).searchParams.get("reason"),
    "connection_failed"
  );
  assert.equal(
    oauth.validateMobileGoogleOAuthReturnUrl("http://app.optimus.example/mobile/oauth/google"),
    false
  );
  assert.equal(
    oauth.validateMobileGoogleOAuthReturnUrl(`${configured}?return=https://attacker.example`),
    false
  );
  assert.equal(
    oauth.validateMobileGoogleOAuthReturnUrl("https://app.optimus.example/other-path"),
    false
  );
});

test("root native association documents validate exact identities and OAuth-only paths", async () => {
  const appLinks = await import(
    pathToFileURL(path.join(root, "src/lib/mobileAppLinks.js"))
  );
  const fingerprint = Array.from({ length: 32 }, (_, index) =>
    index.toString(16).padStart(2, "0")
  ).join(":");
  const environment = {
    NEXT_PUBLIC_SITE_URL: "https://app.optimus.example",
    MOBILE_GOOGLE_OAUTH_RETURN_URL:
      "https://app.optimus.example/mobile/oauth/google",
    MOBILE_APPLE_TEAM_ID: "A1B2C3D4E5",
    MOBILE_IOS_BUNDLE_ID: "com.lancehawks.optimus",
    MOBILE_ANDROID_PACKAGE_NAME: "com.lancehawks.optimus",
    MOBILE_ANDROID_SHA256_FINGERPRINTS: `${fingerprint},${fingerprint}`,
  };

  const apple = appLinks.appleAppSiteAssociation(environment);
  const android = appLinks.androidAssetLinks(environment);
  assert.deepEqual(apple, {
    applinks: {
      apps: [],
      details: [
        {
          appID: "A1B2C3D4E5.com.lancehawks.optimus",
          paths: ["/mobile/oauth/google*"],
        },
      ],
    },
  });
  assert.deepEqual(android[0].relation, [
    "delegate_permission/common.handle_all_urls",
  ]);
  assert.equal(android[0].target.package_name, "com.lancehawks.optimus");
  assert.deepEqual(android[0].target.sha256_cert_fingerprints, [
    fingerprint.toUpperCase(),
  ]);
  assert.deepEqual(
    android[0].relation_extensions[
      "delegate_permission/common.handle_all_urls"
    ].dynamic_app_link_components,
    [
      { "/": "/mobile/oauth/google*" },
      { "/": "*", exclude: true },
    ]
  );
  assert.equal(appLinks.validateMobileAppLinkOrigin(environment), true);
  assert.equal(appLinks.validateAppleAppSiteAssociation(environment), true);
  assert.equal(appLinks.validateAndroidAssetLinks(environment), true);
});

test("native association configuration fails closed for invalid or mismatched values", async () => {
  const appLinks = await import(
    pathToFileURL(path.join(root, "src/lib/mobileAppLinks.js"))
  );
  const validFingerprint = Array(32).fill("AA").join(":");
  const valid = {
    NEXT_PUBLIC_SITE_URL: "https://app.optimus.example",
    MOBILE_GOOGLE_OAUTH_RETURN_URL:
      "https://app.optimus.example/mobile/oauth/google",
    MOBILE_APPLE_TEAM_ID: "A1B2C3D4E5",
    MOBILE_IOS_BUNDLE_ID: "com.lancehawks.optimus",
    MOBILE_ANDROID_PACKAGE_NAME: "com.lancehawks.optimus",
    MOBILE_ANDROID_SHA256_FINGERPRINTS: validFingerprint,
  };

  assert.equal(
    appLinks.validateAppleAppSiteAssociation({
      ...valid,
      MOBILE_APPLE_TEAM_ID: "not-a-team",
    }),
    false
  );
  assert.equal(
    appLinks.validateAppleAppSiteAssociation({
      ...valid,
      MOBILE_IOS_BUNDLE_ID: "*.optimus",
    }),
    false
  );
  assert.equal(
    appLinks.validateAndroidAssetLinks({
      ...valid,
      MOBILE_ANDROID_PACKAGE_NAME: "com.optimus.bad-name",
    }),
    false
  );
  assert.equal(
    appLinks.validateAndroidAssetLinks({
      ...valid,
      MOBILE_ANDROID_SHA256_FINGERPRINTS: "AA:BB",
    }),
    false
  );
  assert.equal(
    appLinks.validateMobileAppLinkOrigin({
      ...valid,
      NEXT_PUBLIC_SITE_URL: "https://different.optimus.example",
    }),
    false
  );
  assert.equal(
    appLinks.validateMobileAppLinkOrigin({
      ...valid,
      NEXT_PUBLIC_SITE_URL: "http://app.optimus.example",
    }),
    false
  );
});

test("well-known association routes are runtime generated, cache safe, and release checked", () => {
  const appleRoute = read(
    "src/app/.well-known/apple-app-site-association/route.js"
  );
  const androidRoute = read("src/app/.well-known/assetlinks.json/route.js");
  const health = read("src/app/api/health/route.js");
  const environment = read(".env.example");

  for (const route of [appleRoute, androidRoute]) {
    assert.match(route, /dynamic = "force-dynamic"/);
    assert.match(route, /revalidate = 0/);
    assert.match(route, /public, max-age=3600, s-maxage=3600/);
    assert.match(route, /status: 503/);
    assert.match(route, /"Cache-Control": "no-store"/);
    assert.match(route, /"X-Content-Type-Options": "nosniff"/);
  }
  assert.match(health, /mobileAppLinkOrigin: validateMobileAppLinkOrigin\(\)/);
  assert.match(
    health,
    /appleAppSiteAssociation: validateAppleAppSiteAssociation\(\)/
  );
  assert.match(health, /androidAssetLinks: validateAndroidAssetLinks\(\)/);
  assert.match(environment, /^MOBILE_APPLE_TEAM_ID=$/m);
  assert.match(environment, /^MOBILE_IOS_BUNDLE_ID=$/m);
  assert.match(environment, /^MOBILE_ANDROID_PACKAGE_NAME=$/m);
  assert.match(environment, /^MOBILE_ANDROID_SHA256_FINGERPRINTS=$/m);
});

test("OAuth flow migration stores only hashed state and encrypted verifier", () => {
  const migration = read("migrations/20260726_mobile_google_oauth.sql");
  const verification = read("scripts/verify-database.mjs");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS google_oauth_flows/);
  assert.match(migration, /session_id UUID NOT NULL REFERENCES sessions\(id\) ON DELETE CASCADE/);
  assert.match(migration, /client_type IN \('web', 'mobile'\)/);
  assert.match(migration, /state_hash VARCHAR\(64\) NOT NULL/);
  assert.match(migration, /code_verifier_ciphertext TEXT NOT NULL/);
  assert.match(migration, /CHECK \(code_verifier_ciphertext LIKE 'enc:v1:%'\)/);
  assert.match(migration, /consumed_at TIMESTAMPTZ/);
  assert.match(migration, /idx_google_oauth_flows_pending/);
  assert.match(migration, /idx_google_oauth_flows_cleanup/);
  assert.match(verification, /"google_oauth_flows"/);
  assert.match(verification, /invalid_google_oauth_flows/);
  assert.match(verification, /mismatched_google_oauth_sessions/);
});

test("OAuth flow creation expires in ten minutes and consumption is atomic", () => {
  const flow = read("src/lib/googleOAuthFlow.js");

  assert.match(flow, /GOOGLE_OAUTH_FLOW_TTL_SECONDS = 10 \* 60/);
  assert.match(flow, /encryptSecret\(codeVerifier\)/);
  assert.match(flow, /session_id, client_type, state_hash, code_verifier_ciphertext, expires_at/);
  assert.match(flow, /hashSessionToken\(sessionToken\)/);
  assert.match(flow, /initiating_session\.expires_at > NOW\(\)/);
  assert.doesNotMatch(flow, /\(user_id, client_type, state,/);
  assert.match(flow, /flow\.expires_at > NOW\(\)/);
  assert.match(flow, /flow\.consumed_at IS NULL/);
  assert.match(flow, /FOR UPDATE OF flow/);
  assert.match(flow, /SET consumed_at = NOW\(\)/);
  assert.match(flow, /LIMIT 500/);
  assert.match(flow, /\(\$3::uuid IS NULL OR flow\.user_id = \$3::uuid\)/);
  assert.match(flow, /decryptSecret\(flow\.code_verifier_ciphertext\)/);
});

test("mobile auth mode is explicit bearer-only while the web response shape remains stable", () => {
  const route = read("src/app/api/google/auth/route.js");
  const api = read("src/services/api.js");

  assert.match(route, /isMobileApiRequest\(request\)/);
  assert.match(
    route,
    /const sessionToken = mobile\s*\? getBearerTokenFromRequest\(request\)\s*: getTokenFromRequest\(request\)/
  );
  assert.match(route, /validateMobileGoogleOAuthReturnUrl\(\)/);
  assert.match(route, /validateMobileAppLinkOrigin\(\)/);
  assert.match(route, /mobile \? "mobile" : "web"/);
  assert.match(route, /\.\.\.\(mobile \? \{ expiresAt: flow\.expiresAt \} : \{\}\)/);
  assert.doesNotMatch(route, /returnUrl|return_url|redirectUri|redirect_uri/);
  assert.match(route, /apiNoStoreResponse/);
  assert.match(api, /getAuthUrl: \(\) => fetchAPI\("\/google\/auth", \{ cache: "no-store" \}\)/);
  assert.match(api, /const cacheableGet = method === "GET" && rest\.cache !== "no-store"/);
});

test("Google authorization URLs use opaque state and PKCE without embedding user identity", () => {
  const google = read("src/lib/google.js");
  const authorization = google.slice(
    google.indexOf("export function getAuthUrl"),
    google.indexOf("export async function getCalendarClient")
  );

  assert.match(authorization, /getAuthUrl\(\{ state, codeChallenge \}\)/);
  assert.match(authorization, /code_challenge: codeChallenge/);
  assert.match(authorization, /code_challenge_method: "S256"/);
  assert.match(authorization, /getToken\(\{ code, codeVerifier \}\)/);
  assert.doesNotMatch(authorization, /jwt|userId|JWT_SECRET/);
});

test("callback consumes mobile state without cookies and redirects only status enums", () => {
  const callback = read("src/app/api/google/callback/route.js");
  const completion = read("src/lib/googleOAuthCompletion.js");
  const mobileHandler = callback.slice(
    callback.indexOf("async function handleMobileCallback"),
    callback.indexOf("async function handleWebCallback")
  );
  const webHandler = callback.slice(
    callback.indexOf("async function handleWebCallback"),
    callback.indexOf("export async function GET")
  );

  assert.match(mobileHandler, /consumeGoogleOAuthFlow/);
  assert.match(mobileHandler, /clientType: "mobile"/);
  assert.doesNotMatch(mobileHandler, /getAuthUser/);
  assert.match(mobileHandler, /completeGoogleOAuthConnection/);
  assert.match(callback, /mobileGoogleOAuthResultUrl\(status, reason\)/);
  assert.match(callback, /Referrer-Policy", "no-referrer"/);
  assert.match(callback, /Cache-Control", "no-store"/);
  assert.doesNotMatch(callback, /returnUrl|return_url|redirectUri|redirect_uri/);
  assert.match(webHandler, /getAuthUser\(request\)/);
  assert.match(webHandler, /expectedUserId: user\.id/);
  assert.match(completion, /encryptSecret\(tokens\.access_token\)/);
  assert.match(completion, /attemptGoogleCalendarSync\(\{ userId \}\)/);
  assert.doesNotMatch(completion, /calendarSyncJob|integrationJobs/);
  assert.doesNotMatch(callback, /tokens\.access_token|tokens\.refresh_token/);
});
