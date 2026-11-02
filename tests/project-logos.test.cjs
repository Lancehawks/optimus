const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const USER = "11111111-1111-4111-8111-111111111111";

test("project logos accept raster images only, under the member's own prefix", async () => {
  const rules = await load("src/lib/uploadRules.js");

  assert.equal(rules.isUploadPurpose("project_logo"), true);
  assert.equal(rules.isOwnPathname(`users/${USER}/project_logo/logo.webp`, USER, "project_logo"), true);
  assert.equal(rules.isOwnPathname(`users/${USER}/note/logo.webp`, USER, "project_logo"), false);
  for (const type of ["image/png", "image/jpeg", "image/webp"]) {
    assert.equal(rules.isAllowedContentType("project_logo", type), true, type);
  }
  for (const type of ["image/svg+xml", "application/pdf", "video/mp4"]) {
    assert.equal(rules.isAllowedContentType("project_logo", type), false, type);
  }
  assert.ok(rules.UPLOAD_RULES.project_logo.maxBytes <= 2 * 1024 * 1024);
});

test("a logo belongs to one project and is released when it's replaced", async () => {
  const { findProjectLogoFile, releaseProjectLogoFiles } = await load("src/lib/projectLogos.js");
  const db = await createSchemaDatabase();
  const insertUser = async (email) => (await db.query(
    "INSERT INTO users (email, full_name, password_hash) VALUES ($1, 'Member', 'x') RETURNING id",
    [email]
  )).rows[0].id;
  const owner = await insertUser("owner@example.com");
  const other = await insertUser("other@example.com");
  const insertFile = async (userId, purpose, pathname) => (await db.query(
    `INSERT INTO uploaded_files (user_id, purpose, pathname, name, content_type, size_bytes)
     VALUES ($1, $2, $3, 'logo.webp', 'image/webp', 100) RETURNING id`,
    [userId, purpose, pathname]
  )).rows[0].id;
  const insertProject = async (name, logoId = null) => (await db.query(
    "INSERT INTO projects (user_id, name, logo_file_id) VALUES ($1, $2, $3) RETURNING id",
    [owner, name, logoId]
  )).rows[0].id;

  const logo = await insertFile(owner, "project_logo", "users/o/project_logo/a.webp");
  const othersLogo = await insertFile(other, "project_logo", "users/x/project_logo/b.webp");
  const noteImage = await insertFile(owner, "note", "users/o/note/c.webp");

  assert.ok(await findProjectLogoFile(db, owner, logo));
  assert.equal(await findProjectLogoFile(db, owner, othersLogo), null);
  assert.equal(await findProjectLogoFile(db, owner, noteImage), null);

  // Once a project uses it, no other project can claim it.
  const first = await insertProject("First", logo);
  assert.equal(await findProjectLogoFile(db, owner, logo), null);
  assert.ok(await findProjectLogoFile(db, owner, logo, first));
  await assert.rejects(insertProject("Second", logo));

  // A logo still in use is kept; a replaced one is removed.
  assert.deepEqual(await releaseProjectLogoFiles(db, [logo, null]), []);
  await db.query("UPDATE projects SET logo_file_id = NULL WHERE id = $1", [first]);
  assert.deepEqual(await releaseProjectLogoFiles(db, [logo, noteImage]), ["users/o/project_logo/a.webp"]);
  const remaining = (await db.query("SELECT id FROM uploaded_files WHERE id = ANY($1::uuid[])", [[logo, noteImage]])).rows;
  assert.deepEqual(remaining.map((row) => row.id), [noteImage]);

  // Deleting the file directly leaves the project without a logo.
  const next = await insertFile(owner, "project_logo", "users/o/project_logo/d.webp");
  await db.query("UPDATE projects SET logo_file_id = $1 WHERE id = $2", [next, first]);
  await db.query("DELETE FROM uploaded_files WHERE id = $1", [next]);
  const after = (await db.query("SELECT logo_file_id FROM projects WHERE id = $1", [first])).rows[0];
  assert.equal(after.logo_file_id, null);
  await db.close();
});

test("logos are checked on save, cleaned up after, and readable by project members", () => {
  const validation = read("src/lib/projectValidation.js");
  assert.equal(validation.match(/optionalUuid\(body\.logoFileId, "Logo"\)/g).length, 2);

  const create = read("src/app/api/projects/route.js");
  assert.match(create, /findProjectLogoFile\(query, request\.user\.id, logoFileId\)/);

  const update = read("src/app/api/projects/[id]/route.js");
  assert.match(update, /findProjectLogoFile\(query, request\.user\.id, updates\.logoFileId, id\)/);
  assert.equal(update.match(/releaseProjectLogoFiles\(client, \[/g).length, 2);
  assert.equal(update.match(/await deleteBlobs\(releasedLogos\)/g).length, 2);

  const files = read("src/app/api/files/[id]/route.js");
  assert.match(files, /f\.purpose = 'project_logo' AND EXISTS/);
  assert.match(files, /WHERE p\.logo_file_id = f\.id AND pm\.user_id = \$1/);
});
