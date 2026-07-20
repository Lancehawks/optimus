const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("opaque cursor pagination round-trips and rejects malformed input", async () => {
  const pagination = await import(pathToFileURL(path.join(root, "src/lib/cursorPagination.js")));
  const encoded = pagination.encodeCursor({ createdAt: "2026-07-18T00:00:00.000Z", id: "row-1" });
  assert.deepEqual(
    pagination.decodeCursor(encoded, ["createdAt", "id"]).value,
    { v: 1, createdAt: "2026-07-18T00:00:00.000Z", id: "row-1" }
  );
  assert.equal(pagination.decodeCursor("not-a-cursor", ["id"]).error, "Pagination cursor is invalid");
});

test("authentication dependency failures remain distinct from invalid sessions", () => {
  const auth = read("src/lib/auth.js");
  const apiUtils = read("src/lib/apiUtils.js");
  const authContext = read("src/context/AuthContext.js");

  const getAuthUser = auth.slice(auth.indexOf("export async function getAuthUser"), auth.indexOf("export function getTokenFromRequest"));
  assert.doesNotMatch(getAuthUser, /catch\s*\(/);
  assert.match(apiUtils, /return apiUnavailable\(\)/);
  assert.match(apiUtils, /status:\s*503/);
  assert.match(authContext, /if \(isUnauthorizedError\(error\)\) \{\s*setUser\(null\)/);
});

test("calendar reads are bounded and do not persist derived missed states", () => {
  const collection = read("src/lib/events/eventCollectionService.js");
  const occurrenceStatus = read("src/lib/eventOccurrenceStatus.js");

  assert.match(collection, /Calendar range cannot exceed 90 days/);
  assert.doesNotMatch(collection, /syncMissedEventStatuses/);
  assert.match(collection, /applyMissedEventDisplayStatuses/);
  assert.match(occurrenceStatus, /unnest\(\$1::uuid\[\], \$2::date\[\]\)/);
});

test("dashboard and Google synchronization use aggregate and durable-job paths", () => {
  const dashboard = read("src/app/(dashboard)/dashboard/page.js");
  const overview = read("src/app/api/dashboard/overview/route.js");
  const googleCallback = read("src/app/api/google/callback/route.js");
  const googleSync = read("src/app/api/google/sync/route.js");

  assert.match(dashboard, /useDashboardOverview/);
  assert.doesNotMatch(dashboard, /useTasks\(|useProjects\(|useEvents\(|useDayPlan\(/);
  assert.match(overview, /WITH blocking_rollup AS/);
  assert.match(googleCallback, /calendarSyncJob/);
  assert.doesNotMatch(googleCallback, /syncGoogleCalendarSet/);
  assert.match(googleSync, /Sync queued/);
});

test("event writes use one transaction with an outbox job", () => {
  const collection = read("src/lib/events/eventCollectionService.js");
  const detail = read("src/lib/events/eventDetailService.js");
  const migration = read("migrations/20260718_reliable_jobs.sql");

  assert.match(collection, /transaction\(async \(client\)/);
  assert.match(collection, /googleEventUpsertJob/);
  assert.match(detail, /googleEventDeleteJob/);
  assert.match(detail, /replaceLinkedTasksForEvent\([\s\S]*db: client/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS integration_jobs/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS integration_job_locks/);
});
