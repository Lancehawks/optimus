const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), "utf8");
}

function loadProjectAccess(projectOwners = new Map()) {
  const source = read("src", "lib", "projectAccess.js")
    .replace(/^import .*;\r?\n/m, "")
    .replaceAll("export async function", "async function")
    .replaceAll("export function", "function");

  const query = async (_text, params) => ({
    rows: projectOwners.get(params[0]) === params[1] ? [{ exists: true }] : [],
  });

  return Function("query", `${source}; return {
    canEditProjectItem,
    canDeleteProjectItem,
    creatorOrProjectOwnerCondition,
    projectItemDeleteCondition,
    projectScopedAccessCondition,
  };`)(query);
}

test("item creators edit their own work while project creators can edit every project item", async () => {
  const access = loadProjectAccess(new Map([["project-1", "owner-1"]]));
  const sharedItem = { user_id: "member-1", project_id: "project-1" };

  assert.equal(await access.canEditProjectItem("member-1", sharedItem), true);
  assert.equal(await access.canEditProjectItem("owner-1", sharedItem), true);
  assert.equal(await access.canEditProjectItem("member-2", sharedItem), false);
});

test("only the project creator deletes project items; personal items stay creator-owned", async () => {
  const access = loadProjectAccess(new Map([["project-1", "owner-1"]]));
  const sharedItem = { user_id: "member-1", project_id: "project-1" };
  const personalItem = { user_id: "member-1", project_id: null };

  assert.equal(await access.canDeleteProjectItem("member-1", sharedItem), false);
  assert.equal(await access.canDeleteProjectItem("owner-1", sharedItem), true);
  assert.equal(await access.canDeleteProjectItem("member-1", personalItem), true);
  assert.equal(await access.canDeleteProjectItem("member-2", personalItem), false);
});

test("SQL permission helpers preserve shared visibility and separate edit from delete", () => {
  const access = loadProjectAccess();

  assert.match(access.projectScopedAccessCondition("item"), /project_members/);
  assert.match(access.creatorOrProjectOwnerCondition("item"), /item\.user_id/);
  assert.match(access.creatorOrProjectOwnerCondition("item"), /FROM projects po/);
  assert.match(access.projectItemDeleteCondition("item"), /item\.project_id IS NULL AND item\.user_id/);
  assert.doesNotMatch(
    access.projectItemDeleteCondition("item").replace(/item\.project_id IS NULL AND item\.user_id[^)]*/g, ""),
    /item\.user_id/
  );
});

test("project-scoped APIs keep the creator policy wired for every shared item type", () => {
  const projectRoute = read("src", "app", "api", "projects", "[id]", "route.js");
  const taskRoute = read("src", "app", "api", "tasks", "[id]", "route.js");
  const noteRoute = read("src", "app", "api", "notes", "[id]", "route.js");
  const eventPermissions = read("src", "lib", "events", "eventPermissions.js");
  const milestoneRoute = read("src", "app", "api", "projects", "[id]", "milestones", "[milestoneId]", "route.js");
  const whiteboardRoute = read("src", "app", "api", "whiteboards", "[id]", "route.js");
  const readingRoute = read("src", "app", "api", "reading-list", "[id]", "route.js");

  assert.match(projectRoute, /p\.id = \$1 AND p\.user_id = \$2/);
  assert.match(taskRoute, /Only the task creator or project creator can edit this task/);
  assert.match(taskRoute, /task\.project_id \? Boolean\(isOwner\) : isCreator/);
  assert.match(noteRoute, /Only the note creator or project creator can edit this note/);
  assert.match(noteRoute, /note\.project_id \? Boolean\(isOwner\) : isCreator/);
  assert.match(eventPermissions, /if \(!event\?\.project_id\) return isEventCreator/);
  assert.match(eventPermissions, /return isProjectOwner\(userId, event\.project_id\)/);
  assert.match(milestoneRoute, /created_by !== request\.user\.id/);
  assert.match(milestoneRoute, /project\.user_id !== request\.user\.id/);
  assert.match(whiteboardRoute, /canEditProjectItem/);
  assert.match(whiteboardRoute, /canDeleteProjectItem/);
  assert.match(readingRoute, /canEditProjectItem/);
  assert.match(readingRoute, /canDeleteProjectItem/);
});

test("milestone creator identity is present in both baseline and migration", () => {
  const baseline = read("database.sql");
  const migration = read("migrations", "20260721_project_item_creators.sql");

  assert.match(baseline, /created_by UUID REFERENCES users\(id\) ON DELETE SET NULL/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS created_by UUID/);
  assert.match(migration, /SET created_by = project\.user_id/);
});
