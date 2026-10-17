import { founderBody } from "@/lib/founderValues";
import { query } from "@/lib/db";
import { apiError, apiNoStoreResponse, apiUnavailable } from "@/lib/apiUtils";
import { cleanText, isUuid, withFounderRoomAccess } from "@/lib/founderApi";

function present(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function parseBody(body) {
  return {
    title: cleanText(body.title, 160),
    body: cleanText(body.body, 12000),
  };
}

function validate(note) {
  if (!note.title) return "Note title is required";
  if (!note.body) return "Write something before saving the note";
  return null;
}

export const GET = withFounderRoomAccess(async () => {
  try {
    const result = await query(
      `SELECT id, title, body, updated_at, xmin::text AS version
       FROM founder_notes ORDER BY updated_at DESC`
    );
    return apiNoStoreResponse({ notes: result.rows.map(present) });
  } catch (error) {
    console.error("Founder notes read error:", error);
    return apiUnavailable("Founder notes are temporarily unavailable");
  }
});

export const POST = withFounderRoomAccess(async (request) => {
  const body = founderBody(await request.json().catch(() => null));
  if (typeof body.body === 'string' && body.body.length > 12000) return apiError('Note must be 12,000 characters or less');
  const note = parseBody(body);
  const validationError = validate(note);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `INSERT INTO founder_notes (title, body, created_by, updated_by)
       VALUES ($1, $2, $3, $3)
       RETURNING id, title, body, updated_at, xmin::text AS version`,
      [note.title, note.body, request.user.id]
    );
    return apiNoStoreResponse({ note: present(result.rows[0]) }, 201);
  } catch (error) {
    console.error("Founder note create error:", error);
    return apiUnavailable("The note could not be created");
  }
});

export const PUT = withFounderRoomAccess(async (request) => {
  const body = founderBody(await request.json().catch(() => null));
  if (!isUuid(body.id)) return apiError("A valid note is required");
  if (!/^\d+$/.test(String(body.version || ""))) return apiError("Reload this note before editing", 409);
  if (typeof body.body === "string" && body.body.length > 12000) return apiError("Note must be 12,000 characters or less");
  const note = parseBody(body);
  const validationError = validate(note);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `UPDATE founder_notes
       SET title = $1, body = $2, updated_by = $3, updated_at = NOW()
       WHERE id = $4 AND xmin::text = $5
       RETURNING id, title, body, updated_at, xmin::text AS version`,
      [note.title, note.body, request.user.id, body.id, body.version]
    );
    if (!result.rows[0]) return apiError("This item changed or was deleted by another founder. Reload before saving; your draft is still here.", 409);
    return apiNoStoreResponse({ note: present(result.rows[0]) });
  } catch (error) {
    console.error("Founder note update error:", error);
    return apiUnavailable("The note could not be updated");
  }
});

export const DELETE = withFounderRoomAccess(async (request) => {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const version = params.get("version");
  if (!/^\d+$/.test(version || "")) return apiError("Reload this item before deleting", 409);
  if (!isUuid(id)) return apiError("A valid note is required");

  try {
    const result = await query("DELETE FROM founder_notes WHERE id = $1 AND xmin::text = $2 RETURNING id", [id, version]);
    if (!result.rows[0]) return apiError("This item changed or was deleted. Reload before deleting.", 409);
    return apiNoStoreResponse({ success: true });
  } catch (error) {
    console.error("Founder note delete error:", error);
    return apiUnavailable("The note could not be removed");
  }
});
