import process from "node:process";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";
import { buildInvitationUrl, INVITATION_TTL_DAYS, issueInvitation, normalizeInvitationEmail } from "../src/lib/invitations.js";

// Issues an Optimus invitation from the command line, for the first member of
// a workspace or when nobody is signed in to send one from Settings.
//   npm run invite -- person@example.com

const email = normalizeInvitationEmail(process.argv[2]);
if (!email) {
  process.stderr.write("Usage: npm run invite -- person@example.com\n");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL, { forceTls: process.env.DATABASE_SSL === "require" }),
});
await client.connect();

try {
  await client.query("BEGIN");
  const issued = await issueInvitation(client, { email, invitedBy: null });
  if (issued.error === "already_member") {
    await client.query("ROLLBACK");
    process.stderr.write(`${email} already has an Optimus account.\n`);
    process.exitCode = 1;
  } else {
    await client.query("COMMIT");
    process.stdout.write(`Invitation for ${email} (valid ${INVITATION_TTL_DAYS} days, single use):\n${buildInvitationUrl(issued.token)}\n`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
