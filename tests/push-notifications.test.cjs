const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("push device registration validates Expo token, platform, device, and metadata", async () => {
  const validation = await import(
    pathToFileURL(path.join(root, "src/lib/pushDeviceValidation.js"))
  );
  const valid = validation.normalizePushDeviceRegistration({
    token: "ExponentPushToken[abcDEF_123-xyz]",
    platform: "IOS",
    deviceId: "install:abc-123",
    deviceName: "  Shivangi's iPhone  ",
    appVersion: "1.0.0",
  });

  assert.deepEqual(valid.value, {
    token: "ExponentPushToken[abcDEF_123-xyz]",
    platform: "ios",
    deviceId: "install:abc-123",
    deviceName: "Shivangi's iPhone",
    appVersion: "1.0.0",
  });
  assert.match(
    validation.normalizePushDeviceRegistration({
      token: "not-an-expo-token",
      platform: "ios",
      deviceId: "install:abc-123",
    }).error,
    /valid Expo push token/
  );
  assert.match(
    validation.normalizePushDeviceRegistration({
      token: "ExpoPushToken[abcDEF_123-xyz]",
      platform: "windows",
      deviceId: "install:abc-123",
    }).error,
    /ios or android/
  );
  assert.match(validation.normalizePushDeviceId("../unsafe").error, /deviceId/);
});

test("device endpoint is authenticated, ownership-scoped, bounded, and never returns the token", () => {
  const route = read("src/app/api/notifications/devices/route.js");
  const devices = read("src/lib/pushDevices.js");
  const presenter = devices.slice(
    devices.indexOf("function presentDevice"),
    devices.indexOf("export async function registerPushDevice")
  );

  assert.match(route, /export const POST = withAuth/);
  assert.match(route, /export const DELETE = withAuth/);
  assert.match(route, /normalizePushDeviceRegistration/);
  assert.match(route, /const sessionToken = getTokenFromRequest\(request\)/);
  assert.match(route, /registerPushDevice\(\s*request\.user\.id,\s*sessionToken,/);
  assert.match(route, /unregisterPushDevice\(\s*request\.user\.id,\s*sessionToken,/);
  assert.match(route, /apiNoStoreResponse\(\{ device \}\)/);
  assert.doesNotMatch(presenter, /expo_push_token|token:/);
  assert.match(devices, /encryptSecret\(registration\.token\)/);
  assert.match(devices, /createHash\("sha256"\)/);
  assert.match(devices, /hashSessionToken\(sessionToken\)/);
  assert.match(devices, /auth_session\.expires_at > NOW\(\)/);
  assert.match(devices, /SET session_id = \$3/);
  assert.match(devices, /\(user_id, session_id, token_ciphertext/);
  assert.match(devices, /MAX_PUSH_DEVICES_PER_USER = 20/);
  assert.match(devices, /WHERE user_id = \$1 AND device_id = \$2/);
  assert.match(devices, /WHERE id = \$1 AND user_id = \$2/);
});

test("Expo client builds minimal payloads and keeps access credentials server-side", async () => {
  const expo = await import(pathToFileURL(path.join(root, "src/lib/expoPushClient.js")));
  const previousSecret = process.env.EXPO_PUSH_ACCESS_TOKEN;
  process.env.EXPO_PUSH_ACCESS_TOKEN = "server-only-push-secret";
  let captured;

  try {
    const message = expo.buildExpoPushMessage({
      notification_id: "notification-1",
      expo_push_token: "ExponentPushToken[abcDEF_123-xyz]",
      type: "time_alert",
      title: "Task due",
      body: "Prepare launch notes",
      entity_type: "task",
      entity_id: "task-1",
      metadata: {
        href: "/tasks?task_id=task-1",
        internalSecret: "must-not-leave-server",
      },
    }, { soundEnabled: false });

    assert.deepEqual(message.data, {
      notificationId: "notification-1",
      type: "time_alert",
      entityType: "task",
      entityId: "task-1",
      href: "/tasks?task_id=task-1",
    });
    assert.equal(Object.hasOwn(message, "sound"), false);
    assert.equal(message.title, "Optimus");
    assert.equal(
      message.body,
      "You have a new update. Open Optimus to view it."
    );
    assert.doesNotMatch(JSON.stringify(message), /Task due|Prepare launch notes/);
    assert.doesNotMatch(JSON.stringify(message), /must-not-leave-server/);
    const unsafeHref = expo.buildExpoPushMessage({
      ...message,
      notification_id: "notification-2",
      expo_push_token: "ExponentPushToken[abcDEF_123-xyz]",
      type: "project_activity",
      metadata: { href: "https://attacker.example/path" },
    });
    assert.equal(Object.hasOwn(unsafeHref.data, "href"), false);

    const tickets = await expo.sendExpoPushMessages([message], {
      fetchImpl: async (url, options) => {
        captured = { url, options };
        return {
          ok: true,
          status: 200,
          async json() {
            return { data: [{ status: "ok", id: "expo-ticket-1" }] };
          },
        };
      },
    });
    assert.equal(captured.url, "https://exp.host/--/api/v2/push/send");
    assert.equal(captured.options.headers.Authorization, "Bearer server-only-push-secret");
    assert.deepEqual(tickets, [{ status: "ok", id: "expo-ticket-1" }]);
    assert.doesNotMatch(JSON.stringify(tickets), /server-only-push-secret/);
  } finally {
    if (previousSecret === undefined) delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    else process.env.EXPO_PUSH_ACCESS_TOKEN = previousSecret;
  }
});

test("Expo client rejects invalid destinations and oversized batches before networking", async () => {
  const expo = await import(pathToFileURL(path.join(root, "src/lib/expoPushClient.js")));
  let networkCalls = 0;
  const fetchImpl = async () => {
    networkCalls += 1;
    throw new Error("network should not be called");
  };

  await assert.rejects(
    expo.sendExpoPushMessages([{ to: "invalid" }], { fetchImpl }),
    /invalid destination/
  );
  await assert.rejects(
    expo.sendExpoPushMessages(
      Array.from({ length: 101 }, () => ({ to: "ExponentPushToken[abcDEF_123-xyz]" })),
      { fetchImpl }
    ),
    /cannot exceed 100/
  );
  assert.equal(networkCalls, 0);
});

test("push migration enforces device ownership, delivery dedupe, and claim indexes", () => {
  const migration = read("migrations/20260726_expo_push_delivery.sql");
  const sessionMigration = read(
    "migrations/20260726_push_device_session_scope.sql"
  );
  const verification = read("scripts/verify-database.mjs");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS push_devices/);
  assert.match(migration, /user_id UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migration, /UNIQUE \(user_id, device_id\)/);
  assert.match(migration, /token_ciphertext TEXT NOT NULL/);
  assert.match(migration, /CHECK \(token_ciphertext LIKE 'enc:v1:%'\)/);
  assert.match(migration, /UNIQUE \(token_hash\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS push_notification_deliveries/);
  assert.match(migration, /UNIQUE \(notification_id, user_id, device_id\)/);
  assert.match(migration, /'pending', 'processing', 'retry', 'accepted'/);
  assert.match(migration, /idx_push_deliveries_claim/);
  assert.match(migration, /idx_push_deliveries_receipts/);
  assert.match(sessionMigration, /ADD COLUMN IF NOT EXISTS session_id UUID/);
  assert.match(sessionMigration, /DELETE FROM push_devices\s*WHERE session_id IS NULL/);
  assert.match(
    sessionMigration,
    /FOREIGN KEY \(session_id, user_id\)\s*REFERENCES sessions\(id, user_id\)\s*ON DELETE CASCADE/
  );
  assert.match(sessionMigration, /ALTER COLUMN session_id SET NOT NULL/);
  assert.match(sessionMigration, /idx_push_devices_session/);
  assert.match(verification, /"push_devices",\s*"push_notification_deliveries"/);
  assert.match(verification, /invalid_push_tokens/);
  assert.match(verification, /mismatched_push_sessions/);
  assert.match(verification, /mismatched_push_devices/);
});

test("push dispatch is out-of-band, bounded, preference-aware, and receipt-checked", () => {
  const worker = read("src/app/api/jobs/integrations/route.js");
  const delivery = read("src/lib/pushDelivery.js");

  const notificationJob = worker.slice(
    worker.indexOf('case "notification_sync": {'),
    worker.indexOf('case "google_calendar_sync": {')
  );
  assert.match(worker, /dispatchExpoPushNotifications/);
  assert.match(notificationJob, /syncLiveNotifications/);
  assert.match(notificationJob, /dispatchExpoPushNotifications/);
  assert.doesNotMatch(worker, /case "expo_push_dispatch"/);
  assert.match(delivery, /notificationPreferenceSqlClause/);
  assert.match(
    delivery,
    /JOIN sessions auth_session[\s\S]*auth_session\.expires_at > NOW\(\)/
  );
  assert.match(delivery, /ON CONFLICT \(notification_id, user_id, device_id\) DO NOTHING/);
  assert.match(delivery, /FOR UPDATE OF delivery SKIP LOCKED/);
  assert.match(delivery, /EXPO_PUSH_BATCH", 50, 100/);
  assert.match(delivery, /getExpoPushReceipts/);
  assert.match(delivery, /DeviceNotRegistered/);
  assert.match(delivery, /process\.env\.EXPO_PUSH_ENABLED === "false"/);
  assert.match(delivery, /if \(deliveries\.length === 0\)/);
});
