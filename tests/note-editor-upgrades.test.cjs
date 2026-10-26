const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createSchemaDatabase } = require("./helpers/schema-database.cjs");

const root = path.resolve(__dirname, "..");
const load = (relativePath) => import(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

test("uploads stay under the member's own prefix and never accept scriptable types", async () => {
  const rules = await load("src/lib/uploadRules.js");

  assert.equal(rules.isOwnPathname(`users/${USER}/note/photo.png`, USER, "note"), true);
  assert.equal(rules.isOwnPathname(`users/${OTHER}/note/photo.png`, USER, "note"), false);
  assert.equal(rules.isOwnPathname(`users/${USER}/resource/photo.png`, USER, "note"), false);
  assert.equal(rules.isOwnPathname(`users/${USER}/note/nested/photo.png`, USER, "note"), false);
  assert.equal(rules.isOwnPathname(`users/${USER}/note/`, USER, "note"), false);
  assert.equal(rules.isOwnPathname(`users/${USER}/note/..`, USER, "note"), false);

  for (const type of ["image/svg+xml", "text/html", "application/javascript", "application/xml", ""]) {
    assert.equal(rules.isAllowedContentType("note", type), false, type);
  }
  assert.equal(rules.isAllowedContentType("resource", "application/pdf"), true);
  assert.equal(rules.isAllowedContentType("note", "IMAGE/PNG; charset=binary"), true);
  assert.equal(rules.isUploadPurpose("toString"), false);

  assert.equal(rules.isInlineContentType("image/png"), true);
  assert.equal(rules.isInlineContentType("application/zip"), false);
  assert.equal(rules.resourceTypeFor("application/pdf"), "pdf");
  assert.equal(rules.resourceTypeFor("image/webp"), "image");
  assert.equal(rules.resourceTypeFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "doc");
  assert.equal(rules.resourceTypeFor("video/mp4"), "other");

  assert.equal(rules.safeFileName("Q3 plan (final).pdf"), "Q3-plan-final-.pdf");
  assert.equal(rules.safeFileName("../../etc/passwd"), "etc-passwd");
  assert.equal(rules.safeFileName("..."), "file");
  assert.equal(rules.displayFileName("a/b\\c\u0000.txt"), "abc.txt");
  assert.equal(rules.fileUrl("abc"), "/api/files/abc");
});

test("local drafts keep only edits the server hasn't confirmed", async () => {
  const drafts = await load("src/lib/noteDrafts.js");

  let draft = drafts.mergeDraft(null, { title: "A", baseRevision: 3, snapshot: true }, 1000);
  assert.deepEqual(draft, { fields: { title: "A" }, savedAt: 1000 });
  draft = drafts.mergeDraft(draft, { content: "<p>x</p>", contentBlocks: [{ type: "paragraph" }] }, 2000);
  assert.deepEqual(Object.keys(draft.fields).sort(), ["content", "contentBlocks", "title"]);
  assert.equal(drafts.mergeDraft(draft, { isPinned: true }), draft);

  // An older save finishing doesn't clear a newer edit.
  const afterOldSave = drafts.withoutSavedFields(draft, { content: "<p>older</p>" });
  assert.equal(afterOldSave.fields.content, "<p>x</p>");
  const afterSave = drafts.withoutSavedFields(draft, { content: "<p>x</p>", contentBlocks: [] });
  assert.deepEqual(afterSave.fields, { title: "A" });
  assert.equal(drafts.withoutSavedFields(afterSave, { title: "A" }), null);

  assert.equal(drafts.draftDiffersFrom(draft, { title: "A", content: "<p>x</p>" }), false);
  assert.equal(drafts.draftDiffersFrom(draft, { title: "B", content: "<p>x</p>" }), true);
  assert.equal(drafts.draftDiffersFrom({ fields: { content: "" } }, { title: "A", content: null }), false);
});

test("writing help sends bounded text and returns clean Markdown", async () => {
  const assist = await load("src/lib/noteAssist.js");
  const long = `${"a".repeat(assist.NOTE_ASSIST_TEXT_MAX)}END`;

  assert.equal(assist.clipAssistText("continue", long).endsWith("END"), true);
  assert.equal(assist.clipAssistText("improve", long).endsWith("END"), false);
  assert.equal(assist.clipAssistText("improve", long).length, assist.NOTE_ASSIST_TEXT_MAX);
  assert.equal(assist.isNoteAssistAction("summarizeNote"), true);
  assert.equal(assist.isNoteAssistAction("constructor"), false);
  assert.match(assist.noteAssistPrompt("fix", "teh"), /<text>\nteh\n<\/text>/);
  assert.equal(assist.cleanAssistReply("```markdown\n- one\n- two\n```"), "- one\n- two");
  assert.equal(assist.cleanAssistReply("  plain  "), "plain");
});

test("plain writing requests send no tools to either provider", async () => {
  const { getModel } = await load("src/lib/ai/models.js");
  const { buildAnthropicRequest } = await load("src/lib/ai/providers/anthropic.js");
  const { buildOpenRouterRequest } = await load("src/lib/ai/providers/openrouter.js");
  const history = [{ kind: "input", content: "Fix: teh" }];

  const anthropic = buildAnthropicRequest({ model: getModel("anthropic:claude-haiku-5-5"), system: "S", tools: [], history, finalStep: true });
  assert.equal("tools" in anthropic, false);
  assert.equal("tool_choice" in anthropic, false);

  const openRouter = buildOpenRouterRequest({ model: getModel("openrouter:z-ai/glm-5.3-flash"), system: "S", tools: [], history });
  assert.equal("tools" in openRouter, false);
  assert.equal("tool_choice" in openRouter, false);
});

test("note saves validate blocks and revisions", async () => {
  const content = await load("src/lib/noteContent.js");

  assert.deepEqual(content.optionalContentBlocks(undefined), { provided: false });
  assert.deepEqual(content.optionalContentBlocks(null), { provided: true, value: null });
  assert.ok(content.optionalContentBlocks([1]).error);
  assert.ok(content.optionalContentBlocks({}).error);
  assert.equal(content.optionalContentBlocks([{ type: "paragraph" }]).value, '[{"type":"paragraph"}]');

  assert.deepEqual(content.optionalRevision(undefined), { provided: false });
  assert.deepEqual(content.optionalRevision(4), { provided: true, value: 4 });
  assert.ok(content.optionalRevision(-1).error);
  assert.ok(content.optionalRevision("4").error);
});

test("version snapshots: one per writing session, always before a restore, never twice", async () => {
  const { snapshotNoteBeforeChange, NOTE_VERSION_INTERVAL_MS, MAX_NOTE_VERSIONS } = await load("src/lib/noteContent.js");
  const db = await createSchemaDatabase();
  const user = (await db.query("INSERT INTO users (email, full_name, password_hash) VALUES ('writer@example.com', 'Writer', 'x') RETURNING id")).rows[0];
  const insertNote = async (fields) => (await db.query(
    `INSERT INTO notes (user_id, title, content, content_blocks, revision, updated_by)
     VALUES ($1, $2, $3, $4::jsonb, $5, $1) RETURNING *`,
    [user.id, fields.title, fields.content, fields.blocks ? JSON.stringify(fields.blocks) : null, fields.revision]
  )).rows[0];
  const count = async (noteId) => Number((await db.query("SELECT COUNT(*) FROM note_versions WHERE note_id = $1", [noteId])).rows[0].count);

  // A fresh, empty note has nothing worth keeping.
  const blank = await insertNote({ title: "Untitled", content: "<p></p>", revision: 0 });
  assert.equal(await snapshotNoteBeforeChange(db, blank), false);

  const note = await insertNote({ title: "Plan", content: "<p>Ship it</p>", blocks: [{ type: "paragraph" }], revision: 3 });
  const now = Date.now();
  assert.equal(await snapshotNoteBeforeChange(db, note, { now }), true);
  const [saved] = (await db.query("SELECT * FROM note_versions WHERE note_id = $1", [note.id])).rows;
  assert.equal(saved.revision, 3);
  assert.equal(saved.edited_by, user.id);
  assert.deepEqual(saved.content_blocks, [{ type: "paragraph" }]);

  // The same state is never stored twice, even when forced.
  assert.equal(await snapshotNoteBeforeChange(db, note, { force: true, now }), false);
  // A newer state within the interval waits, unless forced.
  const edited = { ...note, revision: 4 };
  assert.equal(await snapshotNoteBeforeChange(db, edited, { now: now + 1000 }), false);
  assert.equal(await snapshotNoteBeforeChange(db, edited, { force: true, now: now + 1000 }), true);
  const later = { ...note, revision: 5 };
  assert.equal(await snapshotNoteBeforeChange(db, later, { now: now + NOTE_VERSION_INTERVAL_MS + 60_000 }), true);
  assert.equal(await count(note.id), 3);

  // Only the newest versions are kept.
  for (let revision = 6; revision < 6 + MAX_NOTE_VERSIONS; revision += 1) {
    await snapshotNoteBeforeChange(db, { ...note, revision }, { force: true });
  }
  assert.equal(await count(note.id), MAX_NOTE_VERSIONS);
  await db.close();
});

test("uploaded files: purpose is checked and resources let go of deleted files", async () => {
  const db = await createSchemaDatabase();
  const user = (await db.query("INSERT INTO users (email, full_name, password_hash) VALUES ('files@example.com', 'Files', 'x') RETURNING id")).rows[0];
  await assert.rejects(db.query(
    "INSERT INTO uploaded_files (user_id, purpose, pathname, name, content_type, size_bytes) VALUES ($1, 'avatar', 'p', 'n', 'image/png', 1)",
    [user.id]
  ));
  const file = (await db.query(
    "INSERT INTO uploaded_files (user_id, purpose, pathname, name, content_type, size_bytes) VALUES ($1, 'resource', 'users/x/resource/a.pdf', 'a.pdf', 'application/pdf', 10) RETURNING id",
    [user.id]
  )).rows[0];
  const resource = (await db.query(
    "INSERT INTO resources (user_id, title, type, file_id, file_url) VALUES ($1, 'A', 'pdf', $2, '/api/files/x') RETURNING id",
    [user.id, file.id]
  )).rows[0];
  await db.query("DELETE FROM uploaded_files WHERE id = $1", [file.id]);
  const after = (await db.query("SELECT file_id FROM resources WHERE id = $1", [resource.id])).rows[0];
  assert.equal(after.file_id, null);
  await db.close();
});

test("files are served privately and saves are checked against the loaded revision", () => {
  const fileRoute = read("src/app/api/files/[id]/route.js");
  assert.match(fileRoute, /get\(file\.pathname, \{ access: "private"/);
  assert.match(fileRoute, /"X-Content-Type-Options": "nosniff"/);
  assert.match(fileRoute, /sandbox; /);
  assert.match(fileRoute, /f\.user_id = \$1 OR \(n\.id IS NOT NULL AND/);

  const uploads = read("src/app/api/uploads/route.js");
  assert.match(uploads, /isOwnPathname\(pathname, userId, purpose\)/);
  assert.match(uploads, /allowedContentTypes: rules\.contentTypes/);

  const register = read("src/app/api/files/route.js");
  assert.match(register, /blob = await head\(pathname\)/);
  assert.match(register, /canEditNote\(userId, noteId\.value\)/);

  const noteRoute = read("src/app/api/notes/[id]/route.js");
  assert.match(noteRoute, /SELECT \* FROM notes WHERE id = \$1 FOR UPDATE/);
  assert.match(noteRoute, /updates\.baseRevision !== lockedNote\.revision/);
  assert.match(noteRoute, /code: "note_conflict"/);
  assert.match(noteRoute, /DELETE FROM uploaded_files WHERE note_id = \$1/);

  const deletion = read("src/lib/accountDeletion.js");
  assert.match(deletion, /await deleteBlobs\(result\.filePathnames\)/);

  const page = read("src/app/(dashboard)/notes/page.js");
  assert.match(page, /baseRevision: revisionsRef\.current\.get\(noteId\)/);
  assert.match(page, /saveNoteDraft\(noteId, pickDraftFields\(changes\)\)/);
  assert.match(page, /trackNoteSave\(noteId, \{ \.\.\.changes, snapshot: true \}\)/);
});
