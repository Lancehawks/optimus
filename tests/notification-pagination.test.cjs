const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("notification cursors validate their keyset and requested status", async () => {
  const cursorPagination = await import(
    pathToFileURL(path.join(root, "src/lib/cursorPagination.js"))
  );
  const notificationCursor = await import(
    pathToFileURL(path.join(root, "src/lib/notificationCursor.js"))
  );
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const raw = cursorPagination.encodeCursor({
    status: "unread",
    createdAt: "2026-07-26T12:00:00.000Z",
    id,
  });

  assert.deepEqual(notificationCursor.decodeNotificationCursor(raw, "unread"), {
    value: { createdAt: "2026-07-26T12:00:00.000Z", id },
  });
  assert.equal(
    notificationCursor.decodeNotificationCursor(raw, "all").error,
    "Pagination cursor does not match the requested status"
  );

  for (const values of [
    { status: "unread", createdAt: "yesterday", id },
    {
      status: "unread",
      createdAt: "2026-07-26T12:00:00.000Z",
      id: "not-a-uuid",
    },
  ]) {
    const invalid = cursorPagination.encodeCursor(values);
    assert.equal(
      notificationCursor.decodeNotificationCursor(invalid, "unread").error,
      "Pagination cursor is invalid"
    );
  }
});

test("notification queries use a deterministic created-at and id keyset", () => {
  const queries = read("src/lib/notifications/notificationQueries.js");
  const route = read("src/app/api/notifications/route.js");
  const migration = read(
    "migrations/20260726_notification_cursor_pagination.sql"
  );

  assert.match(
    queries,
    /\(n\.created_at, n\.id\) < \(\$2::timestamptz, \$3::uuid\)/
  );
  assert.equal(
    (queries.match(/ORDER BY n\.created_at DESC, n\.id DESC/g) || []).length,
    2
  );
  assert.match(route, /finishCursorPage\(notificationRows, limit/);
  assert.match(route, /unreadCount: unreadNotificationCount/);
  assert.match(route, /preferences,/);
  assert.match(route, /pagination: page\.pagination/);
  assert.match(
    migration,
    /ON notifications\(user_id, created_at DESC, id DESC\)/
  );
  assert.match(migration, /WHERE read_at IS NULL/);
});
