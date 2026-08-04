const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

test("notifications are limited to project invitations and acceptances", () => {
  const sql = read("src/lib/notifications/notificationSql.js");
  const queries = read("src/lib/notifications/notificationQueries.js");
  const projectActivity = read("src/lib/projectActivity.js");
  const preferences = read("src/lib/notificationPreferences.js");
  const migration = read("migrations/20260804_invitation_notifications_only.sql");

  assert.match(sql, /type IN \('project_invitation', 'project_invitation_accepted'\)/);
  assert.doesNotMatch(queries, /'project_activity'/);
  assert.doesNotMatch(projectActivity, /createProjectActivityNotifications/);
  assert.match(queries, /'project_invitation_accepted'/);
  assert.match(queries, /WHERE \$3 = 'accepted'/);
  assert.doesNotMatch(preferences, /projectActivity|taskReminders|eventReminders|reminderLeadMinutes/);
  assert.match(migration, /DELETE FROM notifications[\s\S]*type NOT IN \('project_invitation', 'project_invitation_accepted'\)/);
  assert.equal(exists("src/app/api/notifications/sync/route.js"), false);
  assert.equal(exists("src/app/api/notifications/[id]/event-completion/route.js"), false);
});

test("scheduled delivery, cron, and remote push surfaces are retired", () => {
  const migration = read("migrations/20260731_in_app_notifications_only.sql");

  assert.equal(exists("vercel.json"), false);
  assert.equal(exists("src/app/api/jobs/integrations/route.js"), false);
  assert.equal(exists("src/app/api/jobs/notifications/route.js"), false);
  assert.equal(exists("src/app/api/notifications/devices/route.js"), false);
  assert.equal(exists("src/lib/pushDelivery.js"), false);
  assert.match(migration, /DELETE FROM integration_jobs[\s\S]*type = 'notification_sync'/);
  assert.match(migration, /DROP TABLE IF EXISTS push_notification_deliveries/);
  assert.match(migration, /DROP TABLE IF EXISTS push_devices/);
});

test("notification refresh avoids continuous development and hidden-tab polling", () => {
  const summaryHook = read("src/hooks/useNotificationSummary.js");
  const center = read("src/components/notifications/NotificationCenter.js");

  assert.match(
    summaryHook,
    /process\.env\.NODE_ENV === "development"\s*\? 0\s*:\s*10 \* 60 \* 1000/
  );
  assert.match(summaryHook, /document\.visibilityState === "visible"/);
  assert.match(summaryHook, /pollInterval > 0/);
  assert.match(center, /if \(nextOpen\)[\s\S]*void fetchSummary\(\)/);
});
