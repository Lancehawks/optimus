import { expect } from "@playwright/test";
import pg from "pg";
import { normalizeDatabaseUrl } from "../../src/lib/databaseUrl.js";
import { issueInvitation } from "../../src/lib/invitations.js";

/**
 * Optimus is invite-only, so test accounts are created the way people join:
 * an invitation is issued directly in the test database, then redeemed
 * through the public signup endpoint, which signs the browser in.
 */
export async function createInvitedAccount(page, { prefix = "e2e", fullName = "Production Test User" } = {}) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to invite e2e accounts.");
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const client = new pg.Client({
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL, { forceTls: process.env.DATABASE_SSL === "require" }),
  });
  await client.connect();
  let token;
  try {
    const issued = await issueInvitation(client, { email, invitedBy: null });
    token = issued.token;
  } finally {
    await client.end();
  }

  const response = await page.request.post("/api/auth/signup", {
    data: { token, fullName, password: "E2e-password-123!" },
  });
  expect(response.status()).toBe(201);
  return { email };
}
