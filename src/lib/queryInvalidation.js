// Query keys start with the API resource they read, e.g. ["tasks", "list", filters].
// A write to a resource changes its own queries first, then the views built
// from it: project cards count tasks, Today summarises tasks and events, etc.
const CHANGED_BY_WRITES_TO = {
  tasks: ["tasks", "projects", "sprints", "events", "day-plan", "dashboard"],
  sprints: ["sprints", "tasks"],
  tags: ["tags", "tasks", "notes"],
  notes: ["notes", "notebooks", "projects", "dashboard"],
  notebooks: ["notebooks", "notes"],
  files: ["notes", "resources"],
  projects: ["projects", "tasks", "sprints", "notes", "whiteboards", "reading-list", "calendars", "events", "dashboard"],
  calendars: ["calendars", "events", "dashboard"],
  events: ["events", "tasks", "projects", "day-plan", "dashboard"],
  google: ["google", "calendars", "events", "dashboard"],
  "day-plan": ["day-plan", "events", "dashboard"],
  checklist: ["checklist", "dashboard"],
  whiteboards: ["whiteboards", "projects"],
  resources: ["resources"],
  "reading-list": ["reading-list", "projects"],
  bookmarks: ["bookmarks", "bookmark-collections"],
  "bookmark-collections": ["bookmark-collections", "bookmarks"],
  "flashcard-decks": ["flashcard-decks"],
  notifications: ["notifications"],
  // Settings and admin screens load their own data on demand.
  assistant: [],
  admin: [],
  invitations: [],
  uploads: [],
};

// POST requests that only compute an answer.
const READS_SENT_AS_POST = new Set(["/notes/assist", "/admin/models/check"]);

// A change confirmed in the assistant panel can touch any part of the workspace.
const ASSISTANT_ACTIONS_PREFIX = "/assistant/actions/";

/**
 * The query roots a successful write to `endpoint` (e.g. "/tasks/42") can
 * change, the written resource first. `null` means anything could have
 * changed, as after an assistant action, accepting a project invitation or
 * editing the profile.
 * @param {string} endpoint
 * @returns {string[] | null}
 */
export function queryRootsChangedBy(endpoint) {
  const path = String(endpoint || "").split("?")[0];
  if (READS_SENT_AS_POST.has(path)) return [];
  if (path.startsWith(ASSISTANT_ACTIONS_PREFIX)) return null;
  const resource = path.split("/")[1];
  return Object.hasOwn(CHANGED_BY_WRITES_TO, resource) ? CHANGED_BY_WRITES_TO[resource] : null;
}
