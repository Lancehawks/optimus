import { expect, test } from "@playwright/test";

async function signup(page, suffix) {
  const response = await page.request.post("/api/auth/signup", {
    data: {
      email: `e2e-${suffix}-${Date.now()}@example.test`,
      fullName: "Production Test User",
      password: "E2e-password-123!",
    },
  });
  expect(response.status()).toBe(201);
}

test("a quick-captured task appears on the open dashboard without a reload", async ({ page }) => {
  await signup(page, "refresh");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  const morningReview = page.getByRole("button", { name: "Let's go" });
  if (await morningReview.isVisible()) await morningReview.click();

  const title = `E2E dashboard task ${Date.now()}`;
  await page.getByRole("button", { name: "Open dashboard actions" }).click();
  await page.getByRole("menuitem", { name: /Quick capture/ }).click();
  await page.getByLabel("Capture", { exact: true }).fill(`task ${title} today urgent`);
  await page.getByRole("button", { name: "Create Task" }).click();

  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 12_000 });
});

test("dashboard API failures render a retryable error instead of an empty success state", async ({ page }) => {
  await signup(page, "failure");
  await page.route("**/api/dashboard/overview?**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Test outage", retryable: true }),
  }));

  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard data could not be refreshed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
