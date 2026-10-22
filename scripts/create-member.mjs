import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import { normalizeDatabaseUrl } from "../src/lib/databaseUrl.js";
import { MemberError, createMember } from "../src/lib/members.js";

// Creates a member from the command line, mainly for the first admin of a
// workspace. Admins add everyone else from the Admin page. The password comes
// from NEW_MEMBER_PASSWORD so it never appears in shell history or ps output:
//
//   NEW_MEMBER_PASSWORD='…' npm run member:create -- \
//     --email person@example.com --name "Full Name" [--admin] [--assistant] [--timezone Asia/Kolkata]

const usage = "Usage: NEW_MEMBER_PASSWORD='…' npm run member:create -- --email person@example.com --name \"Full Name\" [--admin] [--assistant] [--timezone Area/City]\n";

let options;
try {
  ({ values: options } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      timezone: { type: "string" },
      admin: { type: "boolean", default: false },
      assistant: { type: "boolean", default: false },
    },
  }));
} catch {
  process.stderr.write(usage);
  process.exit(1);
}
if (!options.email || !options.name || !process.env.NEW_MEMBER_PASSWORD) {
  process.stderr.write(usage);
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL, { forceTls: process.env.DATABASE_SSL === "require" }),
  max: 1,
});

try {
  await createMember(pool, {
    email: options.email,
    fullName: options.name,
    password: process.env.NEW_MEMBER_PASSWORD,
    role: options.admin ? "admin" : "member",
    timezone: options.timezone,
    assistantEnabled: options.assistant,
  });
  process.stdout.write(`Created ${options.admin ? "admin" : "member"} ${options.email.trim().toLowerCase()}.\n`);
} catch (error) {
  if (!(error instanceof MemberError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
