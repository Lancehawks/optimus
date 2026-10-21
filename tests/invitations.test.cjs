const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("invitation helpers normalise emails and only accept well-formed tokens", async () => {
  const invitations = await import("../src/lib/invitations.js");

  assert.equal(invitations.normalizeInvitationEmail("  Priya@Example.COM "), "priya@example.com");
  assert.equal(invitations.normalizeInvitationEmail("not-an-email"), null);
  assert.equal(invitations.normalizeInvitationEmail(42), null);

  const token = invitations.generateInvitationToken();
  assert.equal(invitations.isWellFormedInvitationToken(token), true);
  assert.equal(invitations.isWellFormedInvitationToken("short"), false);
  assert.equal(invitations.isWellFormedInvitationToken("x".repeat(40) + "; drop"), false);
  assert.match(invitations.hashInvitationToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(invitations.hashInvitationToken(token), token);

  const url = new URL(invitations.buildInvitationUrl(token, "https://optimus.example"));
  assert.equal(url.pathname, "/invite");
  assert.equal(url.searchParams.get("token"), token);

  const now = new Date("2026-10-20T10:00:00Z");
  const base = { expires_at: "2026-10-27T10:00:00Z", accepted_at: null, revoked_at: null };
  assert.equal(invitations.invitationStatus(base, now), "pending");
  assert.equal(invitations.invitationStatus({ ...base, accepted_at: now }, now), "accepted");
  assert.equal(invitations.invitationStatus({ ...base, revoked_at: now }, now), "revoked");
  assert.equal(invitations.invitationStatus({ ...base, expires_at: "2026-10-19T00:00:00Z" }, now), "expired");
});

test("invitations are single use, expire, and never store plaintext tokens in PostgreSQL", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const invitations = await import("../src/lib/invitations.js");
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
      CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) UNIQUE NOT NULL, full_name varchar(150));
    `);
    // PGlite has uuid support built in; the migration's extension line is a no-op there.
    const migration = read("migrations/20261020_workspace_invitations.sql").replace(/CREATE EXTENSION[^;]*;/g, "");
    await db.exec(migration);

    const inviter = (await db.query("INSERT INTO users (email) VALUES ('owner@example.com') RETURNING id")).rows[0];

    assert.deepEqual(
      await invitations.issueInvitation(db, { email: "owner@example.com", invitedBy: inviter.id }),
      { error: "already_member" }
    );

    const first = await invitations.issueInvitation(db, { email: "new@example.com", invitedBy: inviter.id });
    const second = await invitations.issueInvitation(db, { email: "new@example.com", invitedBy: inviter.id });
    assert.ok(first.token && second.token && first.token !== second.token);

    const stored = await db.query("SELECT token_hash FROM workspace_invitations");
    assert.ok(stored.rows.every((row) => row.token_hash !== first.token && row.token_hash.length === 64));

    // Re-inviting revokes the earlier link.
    assert.equal(await invitations.findPendingInvitation(db, first.token), null);
    const pending = await invitations.findPendingInvitation(db, second.token);
    assert.equal(pending.email, "new@example.com");

    const locked = await invitations.lockPendingInvitation(db, second.token);
    const user = (await db.query("INSERT INTO users (email) VALUES ($1) RETURNING id", [locked.email])).rows[0];
    await invitations.markInvitationAccepted(db, locked.id, user.id);
    assert.equal(await invitations.lockPendingInvitation(db, second.token), null, "a used invitation cannot be redeemed again");

    const expired = await invitations.issueInvitation(db, { email: "late@example.com", invitedBy: inviter.id });
    await db.query("UPDATE workspace_invitations SET expires_at = NOW() - INTERVAL '1 minute' WHERE email = 'late@example.com'");
    assert.equal(await invitations.lockPendingInvitation(db, expired.token), null);

    await assert.rejects(
      db.query("INSERT INTO workspace_invitations (email, token_hash, expires_at) VALUES ('Upper@Example.com', $1, NOW())", ["a".repeat(64)])
    );
  } finally {
    await db.close();
  }
});

test("signup is invite-only and takes the email from the invitation", () => {
  const route = read("src/app/api/auth/signup/route.js");

  assert.match(route, /isWellFormedInvitationToken\(token\)/);
  assert.match(route, /An invitation is required to create an account", 403/);
  assert.match(route, /lockPendingInvitation\(client, token\)/);
  assert.match(route, /markInvitationAccepted\(client, invitation\.id, createdUser\.id\)/);
  assert.match(route, /\[invitation\.email, passwordHash, normalizedFullName\]/);
  assert.doesNotMatch(route, /const \{[^}]*\bemail\b[^}]*\} = await request\.json/);
  assert.match(route, /auth:signup:invitation/);
});

test("only signed-in members can issue or revoke invitations", () => {
  const collection = read("src/app/api/invitations/route.js");
  const single = read("src/app/api/invitations/[id]/route.js");
  const preview = read("src/app/api/auth/invitation/route.js");

  assert.match(collection, /export const GET = withAuth/);
  assert.match(collection, /export const POST = withAuth/);
  assert.match(collection, /invitations:create:user/);
  assert.match(single, /export const DELETE = withAuth/);
  assert.match(single, /invited_by = \$2/);
  assert.match(preview, /auth:invitation:ip/);
  assert.doesNotMatch(preview, /token_hash|inviter\.email/);
});

test("deleting an account removes the unused invitations it issued", () => {
  const service = read("src/lib/accountDeletion.js");
  assert.match(service, /DELETE FROM workspace_invitations WHERE invited_by = \$1 AND accepted_at IS NULL/);
});
