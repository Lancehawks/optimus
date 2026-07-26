const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function loadAuthRequestHelpers() {
  const source = fs
    .readFileSync(path.join(root, "src", "lib", "authRequest.js"), "utf8")
    .replaceAll("export function", "function");

  return Function(`${source}; return {
    getBearerTokenFromRequest,
    getRequestSessionToken,
    isMobileApiRequest,
    getMobileSessionCredentials,
  };`)();
}

function request({ authorization, cookie, client } = {}) {
  const headers = new Map();
  if (authorization) headers.set("authorization", authorization);
  if (client) headers.set("x-optimus-client", client);

  return {
    headers: { get: (name) => headers.get(name.toLowerCase()) || null },
    cookies: { get: () => (cookie ? { value: cookie } : undefined) },
  };
}

test("mobile bearer tokens take precedence over the browser cookie", () => {
  const { getBearerTokenFromRequest, getRequestSessionToken } = loadAuthRequestHelpers();
  assert.equal(
    getRequestSessionToken(request({ authorization: "Bearer mobile-token", cookie: "web-token" }), "optimus_token"),
    "mobile-token"
  );
  assert.equal(getBearerTokenFromRequest(request({ authorization: "bearer mobile-token" })), "mobile-token");
  assert.equal(getBearerTokenFromRequest(request({ authorization: "Basic credentials" })), null);
  assert.equal(getBearerTokenFromRequest(request({ authorization: "Bearer token with spaces" })), null);
});

test("browser cookie authentication remains supported", () => {
  const { getRequestSessionToken } = loadAuthRequestHelpers();
  assert.equal(getRequestSessionToken(request({ cookie: "web-token" }), "optimus_token"), "web-token");
  assert.equal(getRequestSessionToken(request(), "optimus_token"), null);
});

test("only the explicit mobile client receives response credentials and expiration", () => {
  const { getMobileSessionCredentials, isMobileApiRequest } = loadAuthRequestHelpers();
  const session = { token: "opaque-token", expiresAt: "2026-08-02T00:00:00.000Z" };

  assert.equal(isMobileApiRequest(request({ client: "mobile" })), true);
  assert.equal(isMobileApiRequest(request({ client: "MOBILE" })), true);
  assert.equal(isMobileApiRequest(request()), false);
  assert.deepEqual(getMobileSessionCredentials(request({ client: "mobile" }), session), session);
  assert.deepEqual(getMobileSessionCredentials(request(), session), {});
});

test("login and signup preserve browser response shape while returning mobile expiry", () => {
  for (const route of ["login", "signup"]) {
    const source = fs.readFileSync(
      path.join(root, "src", "app", "api", "auth", route, "route.js"),
      "utf8"
    );
    assert.match(source, /\.\.\.getMobileSessionCredentials\(request, session\)/);
    assert.match(
      source,
      /if \(!isMobileApiRequest\(request\)\) \{\s*await setAuthCookie\(session\.token\);\s*\}/
    );
    assert.match(source, /apiNoStoreResponse/);
  }
});

test("session tokens are opaque, hashed, and expose canonical expiry timestamps", async () => {
  const sessionTokens = await import("../src/lib/sessionTokens.js");
  const token = sessionTokens.generateSessionToken();
  const secondToken = sessionTokens.generateSessionToken();

  assert.match(token, /^[A-Za-z0-9_-]{64}$/);
  assert.notEqual(token, secondToken);
  assert.match(sessionTokens.hashSessionToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(sessionTokens.hashSessionToken(token), token);
  assert.equal(
    sessionTokens.serializeSessionExpiration("2026-08-02T00:00:00Z"),
    "2026-08-02T00:00:00.000Z"
  );
  assert.throws(() => sessionTokens.serializeSessionExpiration("not-a-date"));
});

test("mobile refresh rotates a valid session under a database lock", async () => {
  const { rotateSessionToken } = await import("../src/lib/mobileSession.js");
  const calls = [];
  const client = {
    async query(text, params) {
      calls.push({ text, params });
      if (calls.length === 1) return { rows: [{ id: "session-1" }] };
      return { rows: [{ expires_at: new Date("2026-08-02T00:00:00.000Z") }] };
    },
  };

  const result = await rotateSessionToken(client, "current-opaque-token");

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /FOR UPDATE OF s/);
  assert.match(calls[0].text, /s\.expires_at > NOW\(\)/);
  assert.notEqual(calls[0].params[0], "current-opaque-token");
  assert.match(calls[0].params[0], /^[a-f0-9]{64}$/);
  assert.match(calls[1].text, /UPDATE sessions/);
  assert.notEqual(calls[1].params[0], result.token);
  assert.match(calls[1].params[0], /^[a-f0-9]{64}$/);
  assert.equal(calls[1].params[1], 7 * 24 * 60 * 60);
  assert.match(result.token, /^[A-Za-z0-9_-]{64}$/);
  assert.equal(result.expiresAt, "2026-08-02T00:00:00.000Z");
});

test("mobile refresh does not mint a token for an invalid or expired session", async () => {
  const { rotateSessionToken } = await import("../src/lib/mobileSession.js");
  let calls = 0;
  const client = {
    async query() {
      calls += 1;
      return { rows: [] };
    },
  };

  assert.equal(await rotateSessionToken(client, "expired-token"), null);
  assert.equal(calls, 1);
});

test("refresh is mobile-only, bearer-only, transactional, and does not mutate cookies", () => {
  const source = fs.readFileSync(
    path.join(root, "src", "app", "api", "auth", "refresh", "route.js"),
    "utf8"
  );

  assert.match(source, /if \(!isMobileApiRequest\(request\)\)/);
  assert.match(source, /getBearerTokenFromRequest\(request\)/);
  assert.match(source, /transaction\(\(client\) => rotateSessionToken\(client, currentToken\)\)/);
  assert.match(source, /apiNoStoreResponse\(rotatedSession\)/);
  assert.doesNotMatch(source, /setAuthCookie|clearAuthCookie|getRequestSessionToken/);
});
