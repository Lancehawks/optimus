import { expect, test } from "@playwright/test";
import { createInvitedAccount } from "./helpers/accounts.js";

// Runs in the browser: the session cookie is Secure, which the browser honours
// on loopback but Playwright's own request client doesn't.
async function api(page, path, { method = "POST", data } = {}) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}

async function createProject(page, name) {
  const { status, body } = await api(page, "/api/projects", { data: { name, color: "#0d6b88" } });
  expect(status).toBe(201);
  return body.project;
}

async function createTask(page, title, projectId) {
  const { status, body } = await api(page, "/api/tasks", { data: { title, ...(projectId ? { projectId } : {}) } });
  expect(status).toBe(201);
  return body.task;
}

// Today at the given hour, so it lands in the calendar's default view.
function todayAt(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

async function createEvent(page, title, { hour = 10, hours = 1, taskIds = [] } = {}) {
  const { status, body } = await api(page, "/api/events", {
    data: { title, start_time: todayAt(hour), end_time: todayAt(hour + hours), task_ids: taskIds },
  });
  expect(status).toBe(201);
  return body.event;
}

test("the sidebar shows active projects as a wrapping row of named logo shortcuts", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "sidebar-logos" });
  await page.goto("/dashboard");
  const projects = [];
  for (let index = 1; index <= 8; index += 1) projects.push(await createProject(page, `Shortcut ${index}`));

  await page.goto("/dashboard");
  const shortcuts = page.getByRole("navigation", { name: "Primary" }).locator('a[href^="/projects?project_id="]');
  await expect(shortcuts).toHaveCount(8);

  // Names are for hover and screen readers, never on show.
  const newest = shortcuts.first();
  await expect(newest).toHaveAttribute("aria-label", "Shortcut 8");
  await expect(newest).toHaveAttribute("title", "Shortcut 8");
  await expect(page.locator("#optimus-sidebar-navigation").getByText("Shortcut 8", { exact: true })).toHaveCount(0);

  const boxes = await shortcuts.evaluateAll((links) => links.map((link) => link.getBoundingClientRect().toJSON()));
  expect(boxes[1].y).toBe(boxes[0].y);
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
  expect(boxes.at(-1).y).toBeGreaterThan(boxes[0].y);

  await newest.click();
  await expect(page).toHaveURL(new RegExp(`project_id=${projects.at(-1).id}`));
});

test("calendar events show the project of their linked task", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "event-project" });
  await page.goto("/calendar");
  const project = await createProject(page, "Apollo launch");
  const projectTask = await createTask(page, "Write launch plan", project.id);
  const looseTask = await createTask(page, "Buy stamps");

  await createEvent(page, "Plan the launch", { hour: 10, taskIds: [projectTask.id] });
  await createEvent(page, "Post office", { hour: 13, taskIds: [looseTask.id] });
  await createEvent(page, "Lunch", { hour: 15 });

  const { body: { events } } = await api(page, `/api/events?start=${encodeURIComponent(todayAt(0))}&end=${encodeURIComponent(todayAt(23))}`, { method: "GET" });
  const linked = events.find((event) => event.title === "Plan the launch").linked_tasks[0];
  expect(linked).toMatchObject({ project_id: project.id, project_name: "Apollo launch", project_color: "#0d6b88" });

  await page.goto("/calendar");
  // A month pill always carries the project, in its label and hover text.
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  const pill = page.getByRole("button", { name: /Plan the launch/ }).first();
  await expect(pill).toContainText("Apollo launch");
  await expect(pill).toHaveAttribute("title", "Plan the launch · Apollo launch");

  // A week block has room to show it outright.
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  const planned = page.getByRole("button", { name: /Plan the launch/ }).first();
  await expect(planned.getByText("Apollo launch", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Post office/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Post office/ }).first()).not.toContainText("Apollo launch");
  await expect(page.getByRole("button", { name: /Lunch/ }).first()).not.toContainText("Apollo launch");

  // The event itself names the project beside the task.
  await planned.click();
  await expect(page.getByRole("dialog").locator("span.truncate", { hasText: /^Apollo launch$/ })).toBeVisible();
});

test("the calendar opens on the day view and a click starts the event at the half-hour slot under it", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "calendar-slot" });
  await page.goto("/calendar");
  await expect(page.getByRole("tab", { name: "Day", exact: true })).toHaveAttribute("aria-selected", "true");

  // The label sits 8px above the top of its hour's row.
  const label = await page.getByText("10 AM", { exact: true }).boundingBox();
  const rowTop = label.y + 8;
  const x = page.viewportSize().width - 120;
  const startsAfterClickAt = async (offset) => {
    await page.mouse.click(x, rowTop + offset);
    const dialog = page.getByRole("dialog");
    const value = await dialog.locator('input[type="datetime-local"]').first().inputValue();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    return value.split("T")[1];
  };

  expect(await startsAfterClickAt(10)).toBe("10:00");
  expect(await startsAfterClickAt(45)).toBe("10:30");
});

test("a note exports to PDF in its on-screen styling, through a sandboxed print frame holding the live note", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "note-pdf" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/notes");
  const { status, body: { note } } = await api(page, "/api/notes", {
    data: {
      title: "Launch <brief>",
      content: "<h2>Goals</h2><p>Ship it &lt;img src=x onerror=\"parent.__ranFromNote=1\"&gt;</p>",
    },
  });
  expect(status).toBe(201);

  // Headless browsers have no print dialog, so capture what would be printed.
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      get() {
        const frameWindow = original.get.call(this);
        if (frameWindow && this.hasAttribute("sandbox")) {
          const frame = this;
          frameWindow.print = () => {
            // Markup that reaches the frame must stay inert, whatever its source.
            const doc = frame.contentDocument;
            doc.body.insertAdjacentHTML("beforeend", '<img src="/missing" onerror="parent.__ranInFrame=1" style="display:none">');
            const appHeading = window.getComputedStyle(document.querySelector(".optimus-note h2"));
            const printedHeading = frameWindow.getComputedStyle(doc.querySelector("main h2"));
            window.__printed = {
              sandbox: frame.getAttribute("sandbox"),
              pageTitle: document.title,
              frameTitle: doc.title,
              heading: doc.querySelector(".note-print-title").textContent,
              text: doc.querySelector("main").textContent,
              appTheme: document.documentElement.getAttribute("data-theme"),
              theme: doc.documentElement.getAttribute("data-theme"),
              editable: doc.querySelectorAll("[contenteditable]").length,
              headingFont: [appHeading.fontFamily, printedHeading.fontFamily],
              headingSize: [appHeading.fontSize, printedHeading.fontSize],
              textColor: frameWindow.getComputedStyle(doc.querySelector("main .bn-inline-content")).color,
              fontsLoaded: doc.fonts.status,
            };
          };
        }
        return frameWindow;
      },
    });
  });

  await page.goto(`/notes?note_id=${note.id}`);
  await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();

  // Edits still waiting to auto-save are part of the export.
  await page.locator(".optimus-note .bn-inline-content").filter({ hasText: "Ship it" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" before Friday");

  await page.getByRole("button", { name: "More note actions" }).click();
  await page.getByRole("menuitem", { name: "Export as PDF" }).click();
  await expect.poll(() => page.evaluate(() => window.__printed?.heading)).toBe("Launch <brief>");

  const printed = await page.evaluate(() => window.__printed);
  expect(printed.sandbox).toBe("allow-same-origin allow-modals");
  expect(printed.frameTitle).toBe("Launch <brief>");
  expect(printed.pageTitle).toBe("Launch <brief>");
  expect(printed.text).toContain("before Friday");
  expect(printed.editable).toBe(0);

  // Same type as on screen, on paper colours even when the app is dark.
  expect(printed.headingFont[1]).toBe(printed.headingFont[0]);
  expect(printed.headingSize[1]).toBe(printed.headingSize[0]);
  expect(printed.fontsLoaded).toBe("loaded");
  expect(printed.appTheme).toBe("dark");
  expect(printed.theme).toBe("light");
  const [red, green, blue] = printed.textColor.match(/\d+/g).map(Number);
  expect(Math.max(red, green, blue)).toBeLessThan(90);

  // The note's text stays text.
  expect(printed.text).toContain('<img src=x onerror="parent.__ranFromNote=1">');

  await page.waitForTimeout(300);
  const ran = await page.evaluate(() => Boolean(window.__ranFromNote || window.__ranInFrame));
  expect(ran).toBe(false);
});
