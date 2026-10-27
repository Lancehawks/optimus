const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const FILE_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

test("avatars are a preset or an uploaded photo, and nothing else", async () => {
  const avatars = await load("src/lib/avatarOptions.js");

  assert.equal(avatars.normalizeAvatarValue("preset:girl-bob"), "preset:girl-bob");
  assert.equal(avatars.normalizeAvatarValue(`file:${FILE_ID.toUpperCase()}`), `file:${FILE_ID}`);
  for (const value of ["file:nope", "file:", "https://example.com/me.png", "javascript:alert(1)", "preset:unknown"]) {
    assert.equal(avatars.normalizeAvatarValue(value), "", value);
  }

  assert.equal(avatars.avatarPhotoId(avatars.photoAvatarValue(FILE_ID)), FILE_ID);
  assert.equal(avatars.avatarPhotoId("preset:girl-bob"), null);
  assert.equal(avatars.avatarImageUrl(`file:${FILE_ID}`), `/api/files/${FILE_ID}`);
  assert.equal(avatars.avatarImageUrl("preset:girl-bob"), "/avatars/girl-bob.svg");
  assert.equal(avatars.avatarImageUrl("blob:http://localhost/abc"), "blob:http://localhost/abc");
  assert.equal(avatars.avatarImageUrl("https://example.com/me.png"), null);

  const rules = await load("src/lib/uploadRules.js");
  assert.equal(rules.isAllowedContentType("avatar", "image/webp"), true);
  assert.equal(rules.isAllowedContentType("avatar", "image/svg+xml"), false);
});

test("a photo must be the member's own, and a replaced one is removed", async () => {
  const { findAvatarPhoto, releaseAvatarPhoto } = await load("src/lib/avatarPhotos.js");
  const db = await createSchemaDatabase();
  const insertUser = async (email) => (await db.query(
    "INSERT INTO users (email, full_name, password_hash) VALUES ($1, 'Member', 'x') RETURNING id",
    [email]
  )).rows[0].id;
  const member = await insertUser("member@example.com");
  const other = await insertUser("other@example.com");
  const insertFile = async (userId, purpose, pathname) => (await db.query(
    `INSERT INTO uploaded_files (user_id, purpose, pathname, name, content_type, size_bytes)
     VALUES ($1, $2, $3, 'photo.webp', 'image/webp', 100) RETURNING id`,
    [userId, purpose, pathname]
  )).rows[0].id;

  const photo = await insertFile(member, "avatar", "users/m/avatar/a.webp");
  const othersPhoto = await insertFile(other, "avatar", "users/o/avatar/b.webp");
  const logo = await insertFile(member, "project_logo", "users/m/project_logo/c.webp");

  assert.ok(await findAvatarPhoto(db, member, photo));
  assert.equal(await findAvatarPhoto(db, member, othersPhoto), null);
  assert.equal(await findAvatarPhoto(db, member, logo), null);

  // Still the avatar: kept. Replaced: removed, with its blob handed back.
  await db.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [`file:${photo}`, member]);
  assert.deepEqual(await releaseAvatarPhoto(db, member, photo), []);
  await db.query("UPDATE users SET avatar_url = 'preset:girl-bob' WHERE id = $1", [member]);
  assert.deepEqual(await releaseAvatarPhoto(db, member, photo), ["users/m/avatar/a.webp"]);
  assert.deepEqual(await releaseAvatarPhoto(db, member, othersPhoto), []);
  assert.deepEqual(await releaseAvatarPhoto(db, member, null), []);
  await db.close();
});

test("photos are checked on save, readable while in use, and failed uploads leave no blob", () => {
  const profile = read("src/app/api/auth/profile/route.js");
  assert.match(profile, /findAvatarPhoto\(query, userId, photoId\)/);
  assert.match(profile, /deleteBlobs\(await releaseAvatarPhoto\(query, userId, replacedPhotoId\)\)/);

  const files = read("src/app/api/files/[id]/route.js");
  assert.match(files, /f\.purpose = 'avatar' AND EXISTS \(\s*SELECT 1 FROM users u WHERE u\.avatar_url = 'file:' \|\| f\.id::text/);

  const register = read("src/app/api/files/route.js");
  assert.match(register, /logError\("files\.register_failed"[^]*await deleteBlobs\(\[pathname\]\)/);
});
