import { expect, test } from "@playwright/test";
import { createInvitedAccount } from "./helpers/accounts.js";

test("signed-out visitors see sign in at the root and cannot sign up without an invitation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up|create/i })).toHaveCount(0);

  const response = await page.request.post("/api/auth/signup", {
    data: { email: `open-${Date.now()}@example.test`, fullName: "No Invite", password: "E2e-password-123!" },
  });
  expect(response.status()).toBe(403);

  await page.goto("/invite?token=not-a-real-invitation-token-000000000");
  await expect(page.getByRole("heading", { name: "This link has expired." })).toBeVisible();
});

test("a quick-captured task appears on Today without a reload", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "refresh" });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();

  const title = `E2E dashboard task ${Date.now()}`;
  await page.getByRole("button", { name: "Quick capture" }).first().click();
  await page.getByLabel("Capture", { exact: true }).fill(`task ${title} today urgent`);
  await page.getByRole("button", { name: "Create Task" }).click();

  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 12_000 });
});

test("Today API failures render a retryable error instead of an empty success state", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "failure" });
  await page.route("**/api/dashboard/overview?**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Test outage", retryable: true }),
  }));

  await page.goto("/dashboard");
  await expect(page.getByText("Today couldn't be refreshed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a new whiteboard opens in the Excalidraw editor", async ({ page }) => {
  await createInvitedAccount(page, { prefix: "whiteboard" });
  await page.goto("/whiteboards");

  await expect(page.getByRole("heading", { name: "Whiteboards", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New board", exact: true }).click();
  await page.getByRole("button", { name: /Blank canvas/ }).click();

  await expect(page.getByRole("button", { name: "Boards", exact: true })).toBeVisible();
  await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 20_000 });
});

test("retired public routes redirect to sign in and the Library", async ({ page }) => {
  for (const path of ["/login", "/signup", "/contact"]) {
    const response = await page.goto(path);
    expect(new URL(page.url()).pathname).toBe("/");
    expect(response.ok()).toBe(true);
  }
  await createInvitedAccount(page, { prefix: "routes" });
  await page.goto("/bookmarks");
  await expect(page).toHaveURL(/\/library\?tab=links/);
  await page.goto("/habits");
  await expect(page).toHaveURL(/\/routines/);
});
