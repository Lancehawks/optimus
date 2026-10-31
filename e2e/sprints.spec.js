import { expect, test } from "@playwright/test";
import { createInvitedAccount } from "./helpers/accounts.js";

// Runs in the browser: the session cookie is Secure, which the browser honours
// on loopback but Playwright's own request client doesn't.
async function api(page, path, { method = "GET", data } = {}) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}

async function createTask(page, title, projectId) {
  const { status, body } = await api(page, "/api/tasks", {
    method: "POST",
    data: { title, ...(projectId ? { projectId } : {}) },
  });
  expect(status).toBe(201);
  return body.task;
}

async function createSprint(page, name) {
  await page.getByRole("button", { name: "New sprint" }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByRole("button", { name: "Create sprint" }).click();
  await expect(sheet).toBeHidden();
}

test("plan a sprint across projects, run it, and close it", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "sprints", fullName: "Sprint Planner" });
  await page.goto("/dashboard");

  const { body: projectBody } = await api(page, "/api/projects", {
    method: "POST",
    data: { name: "Launch", color: "#0d6b88" },
  });
  await createTask(page, "Book the dentist");
  await createTask(page, "Write launch post", projectBody.project.id);
  await createTask(page, "Stays in backlog");

  await page.getByRole("link", { name: "Sprints", exact: true }).click();
  await expect(page).toHaveURL(/\/sprints/);
  await expect(page.getByRole("heading", { name: "No sprint running" })).toBeVisible();

  await createSprint(page, "Sprint A");

  // A new sprint opens into planning, with personal and project tasks together.
  const backlog = page.getByRole("region", { name: "Backlog" });
  const sprint = page.getByRole("region", { name: "Sprint A" });
  await expect(backlog.getByText("Book the dentist")).toBeVisible();
  await expect(backlog.getByRole("button", { name: "Write launch post Launch" })).toBeVisible();

  await page.getByRole("button", { name: "Add Book the dentist to Sprint A" }).click();
  await expect(sprint.getByText("Book the dentist")).toBeVisible();
  await expect(backlog.getByText("Book the dentist")).toBeHidden();

  // Dragging from the backlog does the same as the arrow.
  const handle = page.getByRole("button", { name: "Drag Write launch post" });
  const from = await handle.boundingBox();
  const to = await sprint.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(sprint.getByText("Write launch post")).toBeVisible();
  await expect(backlog.getByText("Write launch post")).toBeHidden();

  // What was planned survives a reload, because it came from the server.
  await page.reload();
  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.getByRole("region", { name: "Sprint A" }).getByText("Write launch post")).toBeVisible();
  await expect(page.getByRole("region", { name: "Backlog" }).getByText("Stays in backlog")).toBeVisible();

  await createSprint(page, "Sprint B");
  await expect(page.getByRole("region", { name: "Sprint B" })).toBeVisible();

  await page.getByLabel("Sprint to plan").selectOption({ label: "Sprint A" });
  await page.getByRole("button", { name: "Start sprint" }).click();
  await expect(page.getByRole("heading", { name: "Sprint A" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

  // The board reflects a task finished through the sheet, and the count follows.
  // The sheet resets its form when the full task arrives, so wait for that first.
  const taskDetail = page.waitForResponse(/\/api\/tasks\/[0-9a-f-]+$/);
  await page.getByRole("heading", { name: "Book the dentist" }).click();
  await taskDetail;
  const taskSheet = page.getByRole("dialog");
  await expect(taskSheet.getByLabel("Sprint")).toHaveValue(/.+/);
  await taskSheet.getByLabel("Status").selectOption("done");
  await taskSheet.getByRole("button", { name: "Save changes" }).click();
  await expect(taskSheet).toBeHidden();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

  await page.getByRole("button", { name: "Close sprint" }).click();
  const closeDialog = page.getByRole("dialog");
  await expect(closeDialog.getByText("1 of 2 tasks done.")).toBeVisible();
  await expect(closeDialog.getByLabel(/Move 1 unfinished task to/)).toHaveValue(/.+/);
  await closeDialog.getByRole("button", { name: "Close sprint" }).click();
  await expect(closeDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "No sprint running" })).toBeVisible();

  // Unfinished work moved to the next sprint; the history keeps the record.
  await page.getByRole("tab", { name: "History" }).click();
  await page.getByRole("button", { name: /Sprint A/ }).first().click();
  await expect(page.getByRole("link", { name: "Book the dentist" })).toBeVisible();
  await expect(page.getByText("Unfinished", { exact: true })).toBeVisible();
  await expect(page.getByText("tasks finished per sprint, last 3")).toBeVisible();

  await page.getByRole("tab", { name: "Plan" }).click();
  await expect(page.getByRole("region", { name: "Sprint B" }).getByText("Write launch post")).toBeVisible();
});

test("one member's sprints never reach anyone else", async ({ page, browser }) => {
  await createInvitedAccount(page, { prefix: "sprint-owner", fullName: "Sprint Owner" });
  await page.goto("/dashboard");
  const task = await createTask(page, "Private planning target");
  const { body } = await api(page, "/api/sprints", {
    method: "POST",
    data: { name: "Owner sprint", startDate: "2026-11-02", endDate: "2026-11-15" },
  });
  const sprintId = body.sprint.id;
  const added = await api(page, `/api/sprints/${sprintId}/tasks`, { method: "POST", data: { taskIds: [task.id] } });
  expect(added.status).toBe(200);

  const own = await api(page, `/api/tasks?sprint_id=${sprintId}`);
  expect(own.body.tasks.map((item) => item.id)).toEqual([task.id]);
  expect(own.body.tasks[0].sprint_id).toBe(sprintId);
  const detail = await api(page, `/api/tasks/${task.id}`);
  expect(detail.body.task.sprint_id).toBe(sprintId);
  const backlog = await api(page, "/api/tasks?sprint_id=none");
  expect(backlog.body.tasks.map((item) => item.id)).not.toContain(task.id);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await createInvitedAccount(otherPage, { prefix: "sprint-other", fullName: "Other Member" });
  await otherPage.goto("/dashboard");
  const otherTask = await createTask(otherPage, "Someone else's task");

  expect((await api(otherPage, "/api/sprints")).body.sprints).toEqual([]);
  expect((await api(otherPage, `/api/sprints/${sprintId}`)).status).toBe(404);
  expect((await api(otherPage, `/api/sprints/${sprintId}/start`, { method: "POST" })).status).toBe(404);
  expect((await api(otherPage, `/api/sprints/${sprintId}`, { method: "DELETE" })).status).toBe(404);
  expect((await api(otherPage, `/api/tasks?sprint_id=${sprintId}`)).body.tasks).toEqual([]);
  expect((await api(otherPage, `/api/sprints/${sprintId}/tasks`, { method: "POST", data: { taskIds: [otherTask.id] } })).status).toBe(404);

  const otherSprint = await api(otherPage, "/api/sprints", {
    method: "POST",
    data: { name: "Other sprint", startDate: "2026-11-02", endDate: "2026-11-15" },
  });
  const stolen = await api(otherPage, `/api/sprints/${otherSprint.body.sprint.id}/tasks`, { method: "POST", data: { taskIds: [task.id] } });
  expect(stolen.status).toBe(400);

  await otherContext.close();
});
