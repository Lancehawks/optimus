import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  validateEncryptionConfiguration,
} from "../src/lib/secretEncryption.js";

const apply = process.argv.includes("--apply");
const allowJwtLegacy = process.argv.includes("--allow-jwt-legacy");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!validateEncryptionConfiguration()) {
  throw new Error("A new, independent 32-byte TOKEN_ENCRYPTION_KEY is required.");
}

function decryptWithKey(value, key) {
  const parts = value.split(":");
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== "enc:v1") {
    throw new Error("Unsupported encrypted token format.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[2], "base64url"));
  decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[4], "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function decodeStoredToken(value) {
  if (!value) throw new Error("A Google connection has a missing token.");
  if (!isEncryptedSecret(value)) return { plaintext: value, source: "plaintext" };

  try {
    return { plaintext: decryptSecret(value), source: "current" };
  } catch (currentError) {
    if (!allowJwtLegacy || !process.env.JWT_SECRET) throw currentError;
    const legacyKey = crypto.createHash("sha256").update(process.env.JWT_SECRET).digest();
    return { plaintext: decryptWithKey(value, legacyKey), source: "legacy-jwt" };
  }
}

const pool = new pg.Pool({
  connectionString: normalizeDatabaseUrl(databaseUrl, { forceTls: process.env.DATABASE_SSL === "require" }),
  max: 1,
  connectionTimeoutMillis: 10_000,
});
const client = await pool.connect();

try {
  const result = await client.query(
    "SELECT id, access_token, refresh_token FROM google_connections ORDER BY created_at, id"
  );
  const decoded = result.rows.map((row) => {
    const access = decodeStoredToken(row.access_token);
    const refresh = decodeStoredToken(row.refresh_token);
    return { id: row.id, access, refresh };
  });
  const counts = decoded.reduce((summary, row) => {
    summary[row.access.source] = (summary[row.access.source] || 0) + 1;
    summary[row.refresh.source] = (summary[row.refresh.source] || 0) + 1;
    return summary;
  }, {});

  process.stdout.write(`${JSON.stringify({
    mode: apply ? "apply" : "verify",
    connections: decoded.length,
    tokenSources: counts,
    compatible: true,
  })}\n`);

  if (!apply) {
    if (decoded.some((row) => row.access.source !== "current" || row.refresh.source !== "current")) {
      process.stdout.write("Verification succeeded, but migration is required. Re-run with --apply after taking a database backup.\n");
    }
  } else {
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('optimus_google_token_encryption'))");
      for (const row of decoded) {
        await client.query(
          `UPDATE google_connections
           SET access_token = $1, refresh_token = $2, updated_at = NOW()
           WHERE id = $3`,
          [encryptSecret(row.access.plaintext), encryptSecret(row.refresh.plaintext), row.id]
        );
      }
      await client.query("COMMIT");
      process.stdout.write(`Encrypted ${decoded.length} Google connection(s) with TOKEN_ENCRYPTION_KEY.\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
