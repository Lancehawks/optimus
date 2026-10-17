import { founderBody } from "@/lib/founderValues";
import { query } from "@/lib/db";
import { apiError, apiNoStoreResponse, apiUnavailable } from "@/lib/apiUtils";
import {
  cleanText,
  isUuid,
  numericValue,
  optionalDate,
  withFounderRoomAccess,
} from "@/lib/founderApi";

const STAGES = new Set(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]);

function present(row) {
  return {
    id: row.id,
    clientName: row.client_name,
    company: row.company || "",
    email: row.email || "",
    owner: row.owner || "",
    stage: row.stage,
    value: Number(row.value || 0),
    followUpOn: row.follow_up_on,
    notes: row.notes || "",
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function parseBody(body) {
  return {
    clientName: cleanText(body.clientName, 160),
    company: cleanText(body.company, 160),
    email: cleanText(body.email, 255).toLowerCase(),
    owner: cleanText(body.owner, 120),
    stage: cleanText(body.stage, 24).toLowerCase() || "new",
    value: numericValue(body.value),
    followUpOn: optionalDate(body.followUpOn),
    notes: cleanText(body.notes, 4000),
  };
}

function validate(item) {
  if (!item.clientName) return "Client or lead name is required";
  if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) return "Enter a valid email address";
  if (!STAGES.has(item.stage)) return "Choose a valid lead stage";
  if (item.value === null || item.value < 0 || item.value > 999999999999) return "Choose a valid lead value";
  if (item.followUpOn === undefined) return "Choose a valid follow-up date";
  return null;
}

export const GET = withFounderRoomAccess(async () => {
  try {
    const result = await query(
      `SELECT id, client_name, company, email, owner, stage, value, follow_up_on, notes, updated_at, xmin::text AS version
       FROM founder_leads
       ORDER BY CASE stage
         WHEN 'negotiation' THEN 0 WHEN 'proposal' THEN 1 WHEN 'qualified' THEN 2
         WHEN 'contacted' THEN 3 WHEN 'new' THEN 4 WHEN 'won' THEN 5 ELSE 6 END,
         follow_up_on ASC NULLS LAST, updated_at DESC`
    );
    return apiNoStoreResponse({ leads: result.rows.map(present) });
  } catch (error) {
    console.error("Founder leads read error:", error);
    return apiUnavailable("Client leads are temporarily unavailable");
  }
});

export const POST = withFounderRoomAccess(async (request) => {
  const item = parseBody(founderBody(await request.json().catch(() => null)));
  const validationError = validate(item);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `INSERT INTO founder_leads
         (client_name, company, email, owner, stage, value, follow_up_on, notes, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id, client_name, company, email, owner, stage, value, follow_up_on, notes, updated_at, xmin::text AS version`,
      [
        item.clientName,
        item.company || null,
        item.email || null,
        item.owner || null,
        item.stage,
        item.value,
        item.followUpOn,
        item.notes || null,
        request.user.id,
      ]
    );
    return apiNoStoreResponse({ lead: present(result.rows[0]) }, 201);
  } catch (error) {
    console.error("Founder lead create error:", error);
    return apiUnavailable("The lead could not be created");
  }
});

export const PUT = withFounderRoomAccess(async (request) => {
  const body = founderBody(await request.json().catch(() => null));
  if (!isUuid(body.id)) return apiError("A valid lead is required");
  if (!/^\d+$/.test(String(body.version || ""))) return apiError("Reload this item before editing", 409);
  const item = parseBody(body);
  const validationError = validate(item);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `UPDATE founder_leads
       SET client_name = $1, company = $2, email = $3, owner = $4,
           stage = $5, value = $6, follow_up_on = $7, notes = $8,
           updated_by = $9, updated_at = NOW()
       WHERE id = $10 AND xmin::text = $11
       RETURNING id, client_name, company, email, owner, stage, value, follow_up_on, notes, updated_at, xmin::text AS version`,
      [
        item.clientName,
        item.company || null,
        item.email || null,
        item.owner || null,
        item.stage,
        item.value,
        item.followUpOn,
        item.notes || null,
        request.user.id,
        body.id,
        body.version,
      ]
    );
    if (!result.rows[0]) return apiError("This item changed or was deleted by another founder. Reload before saving; your draft is still here.", 409);
    return apiNoStoreResponse({ lead: present(result.rows[0]) });
  } catch (error) {
    console.error("Founder lead update error:", error);
    return apiUnavailable("The lead could not be updated");
  }
});

export const DELETE = withFounderRoomAccess(async (request) => {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const version = params.get("version");
  if (!/^\d+$/.test(version || "")) return apiError("Reload this item before deleting", 409);
  if (!isUuid(id)) return apiError("A valid lead is required");

  try {
    const result = await query("DELETE FROM founder_leads WHERE id = $1 AND xmin::text = $2 RETURNING id", [id, version]);
    if (!result.rows[0]) return apiError("This item changed or was deleted. Reload before deleting.", 409);
    return apiNoStoreResponse({ success: true });
  } catch (error) {
    console.error("Founder lead delete error:", error);
    return apiUnavailable("The lead could not be removed");
  }
});
