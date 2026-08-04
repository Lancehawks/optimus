const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

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

test("dashboard uses aggregate reads and Google synchronization runs directly", () => {
  const dashboard = read("src/app/(dashboard)/dashboard/page.js");
  const overview = read("src/app/api/dashboard/overview/route.js");
  const googleCallback = read("src/app/api/google/callback/route.js");
  const googleCompletion = read("src/lib/googleOAuthCompletion.js");
  const googleSync = read("src/app/api/google/sync/route.js");

  assert.match(dashboard, /useDashboardOverview/);
  assert.doesNotMatch(dashboard, /useTasks\(|useProjects\(|useEvents\(|useDayPlan\(/);
  assert.match(overview, /WITH blocking_rollup AS/);
  assert.match(googleCompletion, /attemptGoogleCalendarSync/);
  assert.doesNotMatch(googleCompletion, /calendarSyncJob|integrationJobs/);
  assert.doesNotMatch(googleCallback, /syncGoogleCalendarSet/);
  assert.match(googleSync, /attemptGoogleCalendarSync/);
  assert.match(googleSync, /Google Calendar synced/);
});

test("Google synchronization has no cron or integration worker", () => {
  assert.equal(exists("vercel.json"), false);
  assert.equal(exists("src/app/api/jobs/integrations/route.js"), false);
  assert.equal(exists("src/lib/integrationJobs.js"), false);
});

test("event writes commit locally and call Google directly", () => {
  const collection = read("src/lib/events/eventCollectionService.js");
  const detail = read("src/lib/events/eventDetailService.js");
  const directSync = read("src/lib/events/googleEventSyncService.js");
  const googleSync = read("src/lib/googleSync.js");
  const migration = read("migrations/20260805_remove_integration_job_queue.sql");

  assert.match(collection, /transaction\(async \(client\)/);
  assert.match(collection, /attemptGoogleEventUpsert/);
  assert.doesNotMatch(collection, /googleEventUpsertJob|integrationJobs/);
  assert.match(detail, /attemptGoogleEventUpsert/);
  assert.match(detail, /attemptGoogleOccurrenceStatus/);
  assert.match(detail, /attemptGoogleEventDelete/);
  assert.doesNotMatch(detail, /googleEventDeleteJob|integrationJobs/);
  assert.match(detail, /replaceLinkedTasksForEvent\([\s\S]*db: client/);
  assert.match(directSync, /await operation\(\)/);
  assert.match(directSync, /googleSync: "failed"/);
  assert.doesNotMatch(directSync, /completeIntegrationJob|retryQueued/);
  assert.match(googleSync, /export async function pushPendingEventsToGoogle/);
  assert.match(googleSync, /e\.updated_at > e\.synced_at/);
  assert.match(migration, /DROP TABLE IF EXISTS integration_jobs/);
  assert.match(migration, /DROP TABLE IF EXISTS integration_job_locks/);
});

test("task, note, and project list failures render retryable error states", () => {
  const tasks = read("src/app/(dashboard)/tasks/page.js");
  const notes = read("src/app/(dashboard)/notes/page.js");
  const projects = read("src/app/(dashboard)/projects/page.js");

  for (const page of [tasks, notes, projects]) {
    assert.match(page, /\bisLoading, error, refetch\b/);
    assert.match(page, /<ErrorState/);
    assert.match(page, /onRetry=\{refetch\}/);
  }
  assert.match(tasks, /error && tasks\.length === 0/);
  assert.match(notes, /error && notes\.length === 0/);
  assert.match(projects, /error && projects\.length === 0/);
});

test("note autosave flushes pending content and titles and serializes updates", () => {
  const editor = read("src/components/notes/NoteEditor.js");
  const notes = read("src/app/(dashboard)/notes/page.js");

  assert.match(editor, /pendingChangeRef\.current = \{ content: editor\.getHTML\(\), onChange \}/);
  assert.match(editor, /return pending\.onChange\?\.\(pending\.content\)/);
  assert.match(editor, /flushOnPageHide\(\);/);
  assert.match(notes, /pendingTitleSaveRef\.current = \{ noteId, title \}/);
  assert.match(notes, /const previous = noteSaveQueuesRef\.current\.get\(noteId\)/);
  assert.match(notes, /await flushAllPendingSaves\(\);\s*const data = await noteService\.get/);
  assert.match(notes, /Not saved .* Retry/);
});

test("successful mutations invalidate cached reads and refresh the dashboard", () => {
  const api = read("src/services/api.js");
  const resource = read("src/hooks/useApiResource.js");
  const dashboard = read("src/hooks/useDashboardOverview.js");

  assert.match(api, /responseCacheVersion \+= 1/);
  assert.match(api, /window\.dispatchEvent\(new CustomEvent\(DATA_CHANGED_EVENT/);
  assert.match(api, /requestCacheVersion === responseCacheVersion/);
  assert.match(resource, /options\?\.background === true/);
  assert.match(dashboard, /window\.addEventListener\(DATA_CHANGED_EVENT, scheduleRefresh\)/);
  assert.match(dashboard, /refetchOverview\(\{ background: true \}\)/);
});

test("recurring completion is transition-based and idempotent across single and bulk writes", async () => {
  const recurrence = await import(pathToFileURL(path.join(root, "src/lib/taskRecurrence.js")));
  const single = read("src/app/api/tasks/[id]/route.js");
  const bulk = read("src/app/api/tasks/bulk/route.js");
  const migration = read("migrations/20260722_release_hardening.sql");

  assert.equal(recurrence.nextDueDate("2026-01-31T12:00:00.000Z", "monthly"), "2026-02-28T12:00:00.000Z");
  assert.match(single, /taskBeforeUpdate\.status !== "done"/);
  assert.match(single, /SELECT \* FROM tasks WHERE id = \$1 FOR UPDATE/);
  assert.match(bulk, /transitions = eligible\.rows\.filter\(\(task\) => task\.status !== "done"\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_source_unique/);
  assert.match(recurrence.createNextRecurringTask.toString(), /ON CONFLICT \(recurrence_source_task_id\)/);
});

test("whiteboards serialize saves, preserve a local draft, and reject stale versions", () => {
  const canvas = read("src/components/whiteboards/WhiteboardCanvas.js");
  const route = read("src/app/api/whiteboards/[id]/route.js");
  const migration = read("migrations/20260722_release_hardening.sql");

  assert.match(canvas, /while \(latestDataRef\.current\)/);
  assert.match(canvas, /saveWhiteboardDraft/);
  assert.match(canvas, /if \(!latestDataRef\.current\) latestDataRef\.current = snapshot/);
  assert.match(route, /content_version = content_version \+ 1/);
  assert.match(route, /status: 409/);
  assert.match(migration, /content_version INTEGER NOT NULL DEFAULT 1/);
});

test("audited resource failures expose retry state instead of empty success", () => {
  const files = [
    "src/app/(dashboard)/calendar/page.js",
    "src/app/(dashboard)/dashboard/page.js",
    "src/app/(dashboard)/resources/page.js",
    "src/app/(dashboard)/whiteboards/page.js",
    "src/components/checklist/ChecklistView.js",
    "src/components/day-plan/DayPlannerView.js",
    "src/components/projects/ProjectDetail.js",
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /ErrorState/);
    assert.match(source, /onRetry/);
  }
});
