import crypto from "node:crypto";

const PREFIX = "enc:v1";

function encryptionKey() {
  const configured = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  let key;

  if (configured) {
    key = /^[a-f\d]{64}$/i.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");
  } else if (process.env.NODE_ENV !== "production" && process.env.JWT_SECRET) {
    // Local compatibility only. Production must use an independent key so a
    // signing-secret rotation does not make stored OAuth tokens unreadable.
    key = crypto.createHash("sha256").update(process.env.JWT_SECRET).digest();
  }

  if (!key || key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return key;
}

export function isEncryptedSecret(value) {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(value) {
  if (!value || isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value) {
  if (!value || !isEncryptedSecret(value)) return value;

  const parts = value.split(":");
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    throw new Error("Stored secret has an unsupported encryption format.");
  }

  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const payload = Buffer.from(parts[4], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
}
