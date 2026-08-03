const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function loadEventSecurity() {
  const sourcePath = path.join(root, "src", "lib", "eventSecurity.js");
  const source = fs
    .readFileSync(sourcePath, "utf8")
    .replaceAll("export function", "function");

  return Function(`${source}; return {
    isSharedProjectEventForViewer,
    canEditEventStatus,
    canViewEventForViewer,
    sanitizeEventForViewer,
    sanitizeEventsForViewer,
  };`)();
}

function loadEventPresenter() {
  const sourcePath = path.join(root, "src", "lib", "events", "eventPresenter.js");
  const source = fs
    .readFileSync(sourcePath, "utf8")
    .replaceAll("export function", "function");

  return Function(`${source}; return {
    presentEventForViewer,
    presentEventsForViewer,
  };`)();
}

test("only the event creator can mutate event status", () => {
  const { canEditEventStatus } = loadEventSecurity();
  const event = { id: "event-1", user_id: "owner-1", project_id: "project-1" };

  assert.equal(canEditEventStatus(event, "owner-1"), true);
  assert.equal(canEditEventStatus(event, "collaborator-1"), false);
  assert.equal(canEditEventStatus(null, "owner-1"), false);
});

test("collaborators do not receive creator calendar or Google fields", () => {
  const { sanitizeEventForViewer } = loadEventSecurity();
  const { presentEventForViewer } = loadEventPresenter();
  const sharedEvent = {
    id: "event-1",
    user_id: "owner-1",
    project_id: "project-1",
    project_name: "Launch",
    project_color: "#14b8a6",
    calendar_id: "creator-calendar-1",
    calendar_name: "Private calendar",
    calendar_color: "#ef4444",
    google_event_id: "google-event-1",
    google_rrule: "[\"RRULE:FREQ=DAILY\"]",
    synced_at: "2026-06-30T10:00:00.000Z",
  };

  const collaboratorView = sanitizeEventForViewer(sharedEvent, "collaborator-1");
  assert.equal(collaboratorView.calendar_id, null);
  assert.equal(collaboratorView.calendar_name, "Launch");
  assert.equal(collaboratorView.calendar_color, "#14b8a6");
  assert.equal(collaboratorView.google_event_id, undefined);
  assert.equal(collaboratorView.google_rrule, undefined);
  assert.equal(collaboratorView.synced_at, undefined);

  const ownerView = sanitizeEventForViewer(sharedEvent, "owner-1");
  assert.equal(ownerView.calendar_id, "creator-calendar-1");
  assert.equal(ownerView.google_event_id, "google-event-1");

  const collaboratorDto = presentEventForViewer(sharedEvent, "collaborator-1");
  assert.equal(collaboratorDto.calendar_id, null);
  assert.equal(collaboratorDto.calendar_name, "Launch");
  assert.equal(collaboratorDto.calendar_color, "#14b8a6");
  assert.equal(Object.hasOwn(collaboratorDto, "google_event_id"), false);
  assert.equal(Object.hasOwn(collaboratorDto, "google_rrule"), false);
  assert.equal(Object.hasOwn(collaboratorDto, "synced_at"), false);
});

test("personal events are visible only to their owner", () => {
  const { canViewEventForViewer } = loadEventSecurity();
  const personalEvent = { id: "event-1", user_id: "owner-1", project_id: null };

  assert.equal(canViewEventForViewer(personalEvent, "owner-1", []), true);
  assert.equal(canViewEventForViewer(personalEvent, "collaborator-1", ["project-1"]), false);
});

test("shared project events are visible only to project members", () => {
  const { canViewEventForViewer } = loadEventSecurity();
  const sharedEvent = { id: "event-1", user_id: "owner-1", project_id: "project-1" };

  assert.equal(canViewEventForViewer(sharedEvent, "owner-1", ["project-1"]), true);
  assert.equal(canViewEventForViewer(sharedEvent, "collaborator-1", ["project-1"]), true);
  assert.equal(canViewEventForViewer(sharedEvent, "outsider-1", []), false);
});

test("event API routes keep sanitizer and creator-only status guards wired", () => {
  const eventsRoute = fs.readFileSync(
    path.join(root, "src", "app", "api", "events", "route.js"),
    "utf8"
  );
  const eventRoute = fs.readFileSync(
    path.join(root, "src", "app", "api", "events", "[id]", "route.js"),
    "utf8"
  );
  const eventDetailService = fs.readFileSync(
    path.join(root, "src", "lib", "events", "eventDetailService.js"),
    "utf8"
  );
  const eventCollectionService = fs.readFileSync(
    path.join(root, "src", "lib", "events", "eventCollectionService.js"),
    "utf8"
  );
  const eventRepository = fs.readFileSync(
    path.join(root, "src", "lib", "events", "eventRepository.js"),
    "utf8"
  );
  const eventPermissions = fs.readFileSync(
    path.join(root, "src", "lib", "events", "eventPermissions.js"),
    "utf8"
  );
  assert.match(eventsRoute, /listEventsForRange\(/);
  assert.match(eventsRoute, /createEvent\(/);
  assert.match(eventRoute, /getEventDetails\(/);
  assert.match(eventRoute, /updateEventDetails\(/);
  assert.match(eventRoute, /deleteEventDetails\(/);
  assert.match(eventDetailService, /from "@\/lib\/events\/eventRepository"/);
  assert.match(eventDetailService, /from "@\/lib\/events\/eventStatusService"/);
  assert.match(eventDetailService, /presentEventForViewer\(/);
  assert.match(eventCollectionService, /presentEventsForViewer\(/);
  assert.match(eventDetailService, /canEditEventStatus\(currentEvent,\s*userId\)/);
  assert.match(eventPermissions, /export \{ canEditEventStatus,\s*sanitizeEventForViewer \}/);
  assert.doesNotMatch(eventsRoute, /SELECT\s+e\.\*/i);
  assert.doesNotMatch(eventRoute, /SELECT\s+e\.\*/i);
  assert.doesNotMatch(eventRepository, /SELECT\s+e\.\*/i);
  assert.match(eventRepository, /CASE WHEN e\.user_id = \$\{viewerParam\} THEN e\.google_event_id ELSE NULL END AS google_event_id/);
});
