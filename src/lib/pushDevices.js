import crypto from "node:crypto";
import { query, transaction } from "@/lib/db";
import { encryptSecret } from "@/lib/secretEncryption";
import { hashSessionToken } from "@/lib/sessionTokens";

const MAX_PUSH_DEVICES_PER_USER = 20;

export class PushDeviceConflictError extends Error {
  constructor(message = "This push token is already registered to another device or account") {
    super(message);
    this.name = "PushDeviceConflictError";
  }
}

export class PushDeviceLimitError extends Error {
  constructor() {
    super(`A maximum of ${MAX_PUSH_DEVICES_PER_USER} push devices can be registered`);
    this.name = "PushDeviceLimitError";
  }
}

function presentDevice(row) {
  return {
    id: row.id,
    platform: row.platform,
    deviceId: row.device_id,
    deviceName: row.device_name,
    appVersion: row.app_version,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

export async function registerPushDevice(userId, sessionToken, registration) {
  const tokenHash = crypto.createHash("sha256").update(registration.token).digest("hex");
  const tokenCiphertext = encryptSecret(registration.token);
  const sessionTokenHash = hashSessionToken(sessionToken);

  return transaction(async (client) => {
    const owner = await client.query(
      `SELECT auth_session.id AS session_id
       FROM users account
       JOIN sessions auth_session ON auth_session.user_id = account.id
       WHERE account.id = $1
         AND account.is_active = TRUE
         AND auth_session.token_hash = $2
         AND auth_session.expires_at > NOW()
       FOR UPDATE OF account, auth_session`,
      [userId, sessionTokenHash]
    );
    const sessionId = owner.rows[0]?.session_id;
    if (!sessionId) return null;

    // Expired registrations are never eligible for delivery. Remove matching
    // rows here so a safely re-authenticated installation can register again.
    await client.query(
      `DELETE FROM push_devices device
       USING sessions auth_session
       WHERE device.session_id = auth_session.id
         AND auth_session.expires_at <= NOW()
         AND (
           device.user_id = $1
           OR device.token_hash = $2
         )`,
      [userId, tokenHash]
    );

    const tokenOwner = await client.query(
      `SELECT id, user_id, device_id
       FROM push_devices
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );
    const existingDevice = await client.query(
      `SELECT id
       FROM push_devices
       WHERE user_id = $1 AND device_id = $2
       FOR UPDATE`,
      [userId, registration.deviceId]
    );

    if (
      tokenOwner.rows[0]
      && (
        tokenOwner.rows[0].user_id !== userId
        || (existingDevice.rows[0] && tokenOwner.rows[0].id !== existingDevice.rows[0].id)
        || (!existingDevice.rows[0] && tokenOwner.rows[0].device_id !== registration.deviceId)
      )
    ) {
      throw new PushDeviceConflictError();
    }

    let result;
    if (existingDevice.rows[0]) {
      result = await client.query(
        `UPDATE push_devices
         SET session_id = $3,
             token_ciphertext = $4,
             token_hash = $5,
             platform = $6,
             device_name = $7,
             app_version = $8,
             last_seen_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, platform, device_id, device_name, app_version,
                   last_seen_at, created_at`,
        [
          existingDevice.rows[0].id,
          userId,
          sessionId,
          tokenCiphertext,
          tokenHash,
          registration.platform,
          registration.deviceName,
          registration.appVersion,
        ]
      );
    } else {
      const count = await client.query(
        "SELECT COUNT(*)::int AS count FROM push_devices WHERE user_id = $1",
        [userId]
      );
      if (Number(count.rows[0]?.count) >= MAX_PUSH_DEVICES_PER_USER) {
        throw new PushDeviceLimitError();
      }

      result = await client.query(
        `INSERT INTO push_devices
           (user_id, session_id, token_ciphertext, token_hash, platform, device_id, device_name, app_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, platform, device_id, device_name, app_version,
                   last_seen_at, created_at`,
        [
          userId,
          sessionId,
          tokenCiphertext,
          tokenHash,
          registration.platform,
          registration.deviceId,
          registration.deviceName,
          registration.appVersion,
        ]
      );
    }

    return presentDevice(result.rows[0]);
  });
}

export async function unregisterPushDevice(userId, sessionToken, deviceId) {
  const result = await query(
    `DELETE FROM push_devices device
     USING sessions auth_session
     WHERE device.user_id = $1
       AND device.device_id = $2
       AND device.session_id = auth_session.id
       AND auth_session.user_id = device.user_id
       AND auth_session.token_hash = $3
       AND auth_session.expires_at > NOW()
     RETURNING device.id`,
    [userId, deviceId, hashSessionToken(sessionToken)]
  );
  return Boolean(result.rows[0]);
}
