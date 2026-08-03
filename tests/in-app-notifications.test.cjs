const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

test("notifications are in-app collaboration updates only", () => {
  const sql = read("src/lib/notifications/notificationSql.js");
  const preferences = read("src/lib/notificationPreferences.js");

  assert.match(sql, /type IN \('project_activity', 'project_invitation'\)/);
  assert.doesNotMatch(preferences, /taskReminders|eventReminders|reminderLeadMinutes/);
  assert.equal(exists("src/app/api/notifications/sync/route.js"), false);
  assert.equal(exists("src/app/api/notifications/[id]/event-completion/route.js"), false);
});

test("scheduled delivery and remote push surfaces are retired", () => {
  const worker = read("src/app/api/jobs/integrations/route.js");
  const config = JSON.parse(read("vercel.json"));
  const migration = read("migrations/20260731_in_app_notifications_only.sql");

  assert.deepEqual(config.crons, [
    { path: "/api/jobs/integrations", schedule: "0 1 * * *" },
  ]);
  assert.doesNotMatch(worker, /notification_sync|pushDelivery|Expo/);
  assert.equal(exists("src/app/api/jobs/notifications/route.js"), false);
  assert.equal(exists("src/app/api/notifications/devices/route.js"), false);
  assert.equal(exists("src/lib/pushDelivery.js"), false);
  assert.match(migration, /DELETE FROM integration_jobs[\s\S]*type = 'notification_sync'/);
  assert.match(migration, /DROP TABLE IF EXISTS push_notification_deliveries/);
  assert.match(migration, /DROP TABLE IF EXISTS push_devices/);
});
