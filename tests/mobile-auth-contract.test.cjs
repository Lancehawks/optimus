const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function loadAuthRequestHelpers() {
  const source = fs
    .readFileSync(path.join(root, "src", "lib", "authRequest.js"), "utf8")
    .replaceAll("export function", "function");

  return Function(`${source}; return { getRequestSessionToken, isMobileApiRequest };`)();
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
  const { getRequestSessionToken } = loadAuthRequestHelpers();
  assert.equal(
    getRequestSessionToken(request({ authorization: "Bearer mobile-token", cookie: "web-token" }), "optimus_token"),
    "mobile-token"
  );
});

test("browser cookie authentication remains supported", () => {
  const { getRequestSessionToken } = loadAuthRequestHelpers();
  assert.equal(getRequestSessionToken(request({ cookie: "web-token" }), "optimus_token"), "web-token");
  assert.equal(getRequestSessionToken(request(), "optimus_token"), null);
});

test("only the explicit mobile client receives a response token", () => {
  const { isMobileApiRequest } = loadAuthRequestHelpers();
  assert.equal(isMobileApiRequest(request({ client: "mobile" })), true);
  assert.equal(isMobileApiRequest(request({ client: "MOBILE" })), true);
  assert.equal(isMobileApiRequest(request()), false);
});

test("login and signup gate response tokens behind the mobile header", () => {
  for (const route of ["login", "signup"]) {
    const source = fs.readFileSync(
      path.join(root, "src", "app", "api", "auth", route, "route.js"),
      "utf8"
    );
    assert.match(source, /isMobileApiRequest\(request\) \? \{ token \} : \{\}/);
  }
});
