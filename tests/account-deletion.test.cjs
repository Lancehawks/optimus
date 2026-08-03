const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("account deletion requires a current password and exact confirmation", async () => {
  const validation = await import(
    pathToFileURL(path.join(root, "src/lib/accountDeletionValidation.js"))
  );

  assert.deepEqual(
    validation.validateAccountDeletionInput({
      currentPassword: "correct horse battery staple",
      confirmation: "DELETE MY ACCOUNT",
      userId: "attacker-controlled",
    }),
    { value: { currentPassword: "correct horse battery staple" } }
  );
  assert.match(
    validation.validateAccountDeletionInput({
      currentPassword: "password",
      confirmation: "delete my account",
    }).error,
    /DELETE MY ACCOUNT/
  );
  assert.match(
    validation.validateAccountDeletionInput({
      confirmation: "DELETE MY ACCOUNT",
    }).error,
    /Current password/
  );
});

test("account endpoint is authenticated, rate limited, no-store, and never targets a body user ID", () => {
  const route = read("src/app/api/auth/account/route.js");

  assert.match(route, /export const DELETE = withAuth/);
  assert.match(route, /validateAccountDeletionInput/);
  assert.match(route, /auth:account-delete:ip/);
  assert.match(route, /auth:account-delete:user/);
  assert.match(route, /limit: 3/);
  assert.match(
    route,
    /permanentlyDeleteAccount\(\s*request\.user\.id,\s*input\.value\.currentPassword/
  );
  assert.doesNotMatch(route, /body\.userId|input\.value\.userId/);
  assert.match(route, /apiNoStoreResponse/);
  assert.match(
    route,
    /if \(!isMobileApiRequest\(request\)\) \{\s*try \{\s*await clearAuthCookie\(\)/
  );
});

test("public account-deletion resource is discoverable and performs the same endpoint flow", () => {
  const page = read("src/app/account-deletion/page.js");
  const client = read("src/app/account-deletion/AccountDeletionClient.js");
  const api = read("src/services/api.js");
  const home = read("src/app/page.js");
  const settings = read("src/app/(dashboard)/settings/page.js");
  const sitemap = read("src/app/sitemap.js");

  assert.match(page, /AccountDeletionClient/);
  assert.match(page, /title: "Delete your account"/);
  assert.match(client, /authService\.me\(\)/);
  assert.match(client, /isUnauthorizedError/);
  assert.match(client, /href="\/login"/);
  assert.match(client, /DELETE MY ACCOUNT/);
  assert.match(
    client,
    /authService\.deleteAccount\(\{ currentPassword, confirmation \}\)/
  );
  assert.match(client, /longest-standing active member/);
  assert.match(client, /actor identity removed/);
  assert.match(
    api,
    /deleteAccount: \(data\) =>\s*fetchAPI\("\/auth\/account", \{ method: "DELETE"/
  );
  assert.match(home, /href="\/account-deletion"/);
  assert.match(settings, /href="\/account-deletion"/);
  assert.match(sitemap, /\/account-deletion/);
});

test("password changes reauthenticate and retain only the exact current session", () => {
  const route = read("src/app/api/auth/profile/route.js");
  const service = read("src/lib/passwordChange.js");

  assert.match(route, /getTokenFromRequest\(request\)/);
  assert.match(route, /auth:password-change:user/);
  assert.match(route, /changePasswordAndRevokeOtherSessions/);
  assert.match(route, /Change the password separately from profile updates/);
  assert.match(service, /hashSessionToken\(currentSessionToken\)/);
  assert.match(service, /auth_session\.expires_at > NOW\(\)/);
  assert.match(service, /FOR UPDATE OF account, auth_session/);
  assert.match(service, /bcrypt\.compare/);
  assert.match(service, /bcrypt\.hash\(newPassword, 12\)/);
  assert.match(
    service,
    /DELETE FROM sessions\s*WHERE user_id = \$1\s*AND id <> \$2/
  );
  assert.doesNotMatch(service, /UPDATE sessions[\s\S]*token_hash/);
});

test("account deletion transfers shared work then hard-deletes credentials and personal data", () => {
  const service = read("src/lib/accountDeletion.js");
  const migration = read("migrations/20260726_account_deletion.sql");
  const activity = read("src/lib/projectActivity.js");

  assert.match(service, /FROM users[\s\S]*FOR UPDATE/);
  assert.match(service, /bcrypt\.compare/);
  assert.match(service, /DISTINCT ON \(project\.id\)/);
  assert.match(service, /candidate\.is_active = TRUE/);
  assert.match(service, /ORDER BY project\.id, member\.created_at, member\.user_id/);
  assert.match(service, /UPDATE projects project[\s\S]*successor_user_id/);
  assert.match(service, /DELETE FROM projects WHERE user_id = \$1/);
  for (const table of ["tasks", "notes", "whiteboards", "reading_list"]) {
    assert.match(
      service,
      new RegExp(`UPDATE ${table} item[\\s\\S]*item\\.project_id = project\\.id`)
    );
  }
  assert.match(service, /UPDATE events event[\s\S]*calendar_id = target_calendar\.id/);
  assert.match(service, /UPDATE tasks child[\s\S]*parent_task_id = NULL/);
  assert.match(service, /google_event_id = NULL/);
  assert.match(service, /DELETE FROM google_connections WHERE user_id = \$1/);
  assert.match(service, /DELETE FROM google_oauth_flows WHERE user_id = \$1/);
  assert.match(service, /DELETE FROM sessions WHERE user_id = \$1/);
  assert.match(service, /DELETE FROM users WHERE id = \$1 RETURNING id/);
  assert.match(migration, /ALTER COLUMN actor_user_id DROP NOT NULL/);
  assert.match(
    migration,
    /FOREIGN KEY \(actor_user_id\)[\s\S]*ON DELETE SET NULL/
  );
  assert.match(activity, /LEFT JOIN users actor ON actor\.id = pa\.actor_user_id/);
  assert.match(activity, /COALESCE\(actor\.full_name, 'Deleted account'\)/);
});
