const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const task = (id, project) => ({
  id,
  title: `Task ${id}`,
  status: "todo",
  priority: "medium",
  project_id: project?.id ?? null,
  project_name: project?.name ?? null,
  project_color: project?.color ?? null,
  project_logo_file_id: project?.logo ?? null,
});

test("an event lists each of its linked tasks' projects once, in a stable order", async () => {
  const { getLinkedTaskProjects } = await load("src/lib/eventDisplay.js");
  const beta = { id: "p-beta", name: "Beta", color: "#111111", logo: "file-1" };
  const alpha = { id: "p-alpha", name: "Alpha", color: "#222222", logo: null };

  assert.deepEqual(
    getLinkedTaskProjects({ linked_tasks: [task("1", beta), task("2", null), task("3", alpha), task("4", beta)] }),
    [
      { id: "p-alpha", name: "Alpha", color: "#222222", logo_file_id: null },
      { id: "p-beta", name: "Beta", color: "#111111", logo_file_id: "file-1" },
    ]
  );
});

test("events without a project behind their tasks list no projects", async () => {
  const { getLinkedTaskProjects } = await load("src/lib/eventDisplay.js");

  assert.deepEqual(getLinkedTaskProjects({ linked_tasks: [task("1", null)] }), []);
  assert.deepEqual(getLinkedTaskProjects({ linked_tasks: [] }), []);
  assert.deepEqual(getLinkedTaskProjects({}), []);
  assert.deepEqual(getLinkedTaskProjects(null), []);
});

test("linked tasks keep their project through the presenter", async () => {
  const { presentEventForViewer } = await load("src/lib/events/eventPresenter.js");
  const project = { id: "p-1", name: "Launch", color: "#0d6b88", logo: "file-1" };

  const presented = presentEventForViewer({ id: "e-1", user_id: "u-1", linked_tasks: [task("1", project)] }, "u-1");

  assert.deepEqual(presented.linked_tasks[0], task("1", project));
});

test("both linked-task queries read the project under the existing access check", () => {
  const repository = read("src/lib/events/eventRepository.js");

  assert.equal(repository.match(/\$\{LINKED_TASK_PROJECT_SELECT\}/g).length, 2);
  assert.equal(repository.match(/LEFT JOIN projects p ON p\.id = t\.project_id/g).length, 2);
  assert.equal(repository.match(/WHERE \$\{projectScopedAccessCondition\("t"\)\}/g).length, 3);
});

test("a click on the time grid lands on the half-hour slot under it", async () => {
  const { getSlotMinutes, HOUR_HEIGHT } = await load("src/lib/calendarUtils.js");

  assert.equal(getSlotMinutes(0), 0);
  assert.equal(getSlotMinutes(HOUR_HEIGHT / 2 - 1), 0);
  assert.equal(getSlotMinutes(HOUR_HEIGHT / 2), 30);
  assert.equal(getSlotMinutes(HOUR_HEIGHT - 1), 30);
});

test("the calendar opens on the day view", () => {
  assert.match(read("src/app/(dashboard)/calendar/page.js"), /const \[viewMode, setViewMode\] = useState\("day"\)/);
});

test("note PDFs print in a frame where nothing in the note can run", () => {
  const source = read("src/lib/notePdf.js");

  assert.match(source, /setAttribute\("sandbox", "allow-same-origin allow-modals"\)/);
  assert.doesNotMatch(source, /sandbox[^\n]*allow-scripts"/);
});
