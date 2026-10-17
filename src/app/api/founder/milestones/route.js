import { founderBody } from "@/lib/founderValues";
import { query } from "@/lib/db";
import { apiError, apiNoStoreResponse, apiUnavailable } from "@/lib/apiUtils";
import { cleanText, isUuid, optionalDate, withFounderRoomAccess } from "@/lib/founderApi";

const STATUSES = new Set(["planned", "active", "achieved"]);

function present(row) {
  return {
    id: row.id,
    title: row.title,
    details: row.details || "",
    milestoneOn: row.milestone_on,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function parseBody(body) {
  return {
    title: cleanText(body.title, 160),
    details: cleanText(body.details, 2000),
    milestoneOn: optionalDate(body.milestoneOn),
    status: cleanText(body.status, 20).toLowerCase() || "planned",
  };
}

function validate(item) {
  if (!item.title) return "Milestone title is required";
  if (!item.milestoneOn) return "Choose a valid milestone date";
  if (!STATUSES.has(item.status)) return "Choose a valid milestone status";
  return null;
}

export const GET = withFounderRoomAccess(async () => {
  try {
    const result = await query(
      `SELECT id, title, details, milestone_on, status, updated_at, xmin::text AS version
       FROM founder_milestones
       ORDER BY milestone_on ASC, created_at ASC`
    );
    return apiNoStoreResponse({ milestones: result.rows.map(present) });
  } catch (error) {
    console.error("Founder milestones read error:", error);
    return apiUnavailable("Company milestones are temporarily unavailable");
  }
});

export const POST = withFounderRoomAccess(async (request) => {
  const item = parseBody(founderBody(await request.json().catch(() => null)));
  const validationError = validate(item);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `INSERT INTO founder_milestones
         (title, details, milestone_on, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, title, details, milestone_on, status, updated_at, xmin::text AS version`,
      [item.title, item.details || null, item.milestoneOn, item.status, request.user.id]
    );
    return apiNoStoreResponse({ milestone: present(result.rows[0]) }, 201);
  } catch (error) {
    console.error("Founder milestone create error:", error);
    return apiUnavailable("The milestone could not be created");
  }
});

export const PUT = withFounderRoomAccess(async (request) => {
  const body = founderBody(await request.json().catch(() => null));
  if (!isUuid(body.id)) return apiError("A valid milestone is required");
  if (!/^\d+$/.test(String(body.version || ""))) return apiError("Reload this item before editing", 409);
  const item = parseBody(body);
  const validationError = validate(item);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `UPDATE founder_milestones
       SET title = $1, details = $2, milestone_on = $3, status = $4,
           updated_by = $5, updated_at = NOW()
       WHERE id = $6 AND xmin::text = $7
       RETURNING id, title, details, milestone_on, status, updated_at, xmin::text AS version`,
      [item.title, item.details || null, item.milestoneOn, item.status, request.user.id, body.id, body.version]
    );
    if (!result.rows[0]) return apiError("This item changed or was deleted by another founder. Reload before saving; your draft is still here.", 409);
    return apiNoStoreResponse({ milestone: present(result.rows[0]) });
  } catch (error) {
    console.error("Founder milestone update error:", error);
    return apiUnavailable("The milestone could not be updated");
  }
});

export const DELETE = withFounderRoomAccess(async (request) => {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const version = params.get("version");
  if (!/^\d+$/.test(version || "")) return apiError("Reload this item before deleting", 409);
  if (!isUuid(id)) return apiError("A valid milestone is required");

  try {
    const result = await query("DELETE FROM founder_milestones WHERE id = $1 AND xmin::text = $2 RETURNING id", [id, version]);
    if (!result.rows[0]) return apiError("This item changed or was deleted. Reload before deleting.", 409);
    return apiNoStoreResponse({ success: true });
  } catch (error) {
    console.error("Founder milestone delete error:", error);
    return apiUnavailable("The milestone could not be removed");
  }
});
