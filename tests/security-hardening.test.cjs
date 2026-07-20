const { test } = require("node:test");
const assert = require("node:assert/strict");

test("OAuth secrets encrypt with authenticated encryption and reject tampering", async () => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const { decryptSecret, encryptSecret, isEncryptedSecret } = await import("../src/lib/secretEncryption.js");
  const encrypted = encryptSecret("refresh-token-value");
  assert.equal(isEncryptedSecret(encrypted), true);
  assert.equal(decryptSecret(encrypted), "refresh-token-value");
  const parts = encrypted.split(":");
  parts[4] = `${parts[4][0] === "A" ? "B" : "A"}${parts[4].slice(1)}`;
  const tampered = parts.join(":");
  assert.throws(() => decryptSecret(tampered));
});

test("bookmark metadata URL guard rejects unsafe protocols and reserved networks", async () => {
  const { isPrivateOrReservedIp, normalizePublicHttpUrl } = await import("../src/lib/safeRemoteMetadata.js");
  assert.equal(normalizePublicHttpUrl("https://example.com/path").hostname, "example.com");
  assert.throws(() => normalizePublicHttpUrl("file:///etc/passwd"));
  assert.throws(() => normalizePublicHttpUrl("http://user:pass@example.com"));
  assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
  assert.equal(isPrivateOrReservedIp("10.2.3.4"), true);
  assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
  assert.equal(isPrivateOrReservedIp("::1"), true);
  assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
});

test("database baseline has one definition per core integration and valid project ordering", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const schema = fs.readFileSync(path.join(__dirname, "..", "database.sql"), "utf8");
  assert.equal((schema.match(/CREATE TABLE ai_chats\s*\(/g) || []).length, 1);
  assert.equal((schema.match(/CREATE TABLE google_connections\s*\(/g) || []).length, 1);
  assert.ok(schema.indexOf("CREATE TABLE projects") < schema.indexOf("CREATE TABLE notes"));
  assert.ok(schema.includes("token_hash VARCHAR(64) NOT NULL"));
  assert.ok(schema.includes("CREATE UNIQUE INDEX idx_sessions_token_hash"));
});

test("database URLs explicitly preserve certificate verification", async () => {
  const { normalizeDatabaseUrl } = await import("../src/lib/databaseUrl.js");
  const normalized = normalizeDatabaseUrl(
    "postgresql://user:password@example.com:5432/app?sslmode=require"
  );
  assert.equal(new URL(normalized).searchParams.get("sslmode"), "verify-full");
  assert.equal(
    normalizeDatabaseUrl("postgresql://localhost:5432/app"),
    "postgresql://localhost:5432/app"
  );
});
