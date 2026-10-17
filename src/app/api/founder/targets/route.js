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

const STATUSES = new Set(["active", "achieved", "paused"]);

function present(row) {
  return {
    id: row.id,
    title: row.title,
    currentValue: Number(row.current_value),
    targetValue: Number(row.target_value),
    unit: row.unit || "",
    deadline: row.deadline,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function parseBody(body) {
  return {
    title: cleanText(body.title, 160),
    currentValue: numericValue(body.currentValue),
    targetValue: numericValue(body.targetValue),
    unit: cleanText(body.unit, 24),
    deadline: optionalDate(body.deadline),
    status: cleanText(body.status, 20).toLowerCase() || "active",
  };
}

function validate(item) {
  if (!item.title) return "Target title is required";
  if (item.currentValue === null || item.currentValue < 0 || item.currentValue > 999999999999) return "Choose a current value between 0 and 999999999999";
  if (item.targetValue === null || item.targetValue <= 0 || item.targetValue > 999999999999) return "Target value must be greater than zero and at most 999999999999";
  if (item.deadline === undefined) return "Choose a valid target deadline";
  if (!STATUSES.has(item.status)) return "Choose a valid target status";
  return null;
}

export const GET = withFounderRoomAccess(async () => {
  try {
    const result = await query(
      `SELECT id, title, current_value, target_value, unit, deadline, status, updated_at, xmin::text AS version
       FROM founder_targets
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                deadline ASC NULLS LAST, created_at ASC`
    );
    return apiNoStoreResponse({ targets: result.rows.map(present) });
  } catch (error) {
    console.error("Founder targets read error:", error);
    return apiUnavailable("Company targets are temporarily unavailable");
  }
});

export const POST = withFounderRoomAccess(async (request) => {
  const item = parseBody(founderBody(await request.json().catch(() => null)));
  const validationError = validate(item);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `INSERT INTO founder_targets
         (title, current_value, target_value, unit, deadline, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, title, current_value, target_value, unit, deadline, status, updated_at, xmin::text AS version`,
      [
        item.title,
        item.currentValue,
        item.targetValue,
        item.unit,
        item.deadline,
        item.status,
        request.user.id,
      ]
    );
    return apiNoStoreResponse({ target: present(result.rows[0]) }, 201);
  } catch (error) {
    console.error("Founder target create error:", error);
    return apiUnavailable("The target could not be created");
  }
});

export const PUT = withFounderRoomAccess(async (request) => {
  const body = founderBody(await request.json().catch(() => null));
  if (!isUuid(body.id)) return apiError("A valid target is required");
  if (!/^\d+$/.test(String(body.version || ""))) return apiError("Reload this item before editing", 409);
  const item = parseBody(body);
  const validationError = validate(item);
  if (validationError) return apiError(validationError);

  try {
    const result = await query(
      `UPDATE founder_targets
       SET title = $1, current_value = $2, target_value = $3, unit = $4,
           deadline = $5, status = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $8 AND xmin::text = $9
       RETURNING id, title, current_value, target_value, unit, deadline, status, updated_at, xmin::text AS version`,
      [
        item.title,
        item.currentValue,
        item.targetValue,
        item.unit,
        item.deadline,
        item.status,
        request.user.id,
        body.id,
        body.version,
      ]
    );
    if (!result.rows[0]) return apiError("This item changed or was deleted by another founder. Reload before saving; your draft is still here.", 409);
    return apiNoStoreResponse({ target: present(result.rows[0]) });
  } catch (error) {
    console.error("Founder target update error:", error);
    return apiUnavailable("The target could not be updated");
  }
});

export const DELETE = withFounderRoomAccess(async (request) => {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const version = params.get("version");
  if (!/^\d+$/.test(version || "")) return apiError("Reload this item before deleting", 409);
  if (!isUuid(id)) return apiError("A valid target is required");

  try {
    const result = await query("DELETE FROM founder_targets WHERE id = $1 AND xmin::text = $2 RETURNING id", [id, version]);
    if (!result.rows[0]) return apiError("This item changed or was deleted. Reload before deleting.", 409);
    return apiNoStoreResponse({ success: true });
  } catch (error) {
    console.error("Founder target delete error:", error);
    return apiUnavailable("The target could not be removed");
  }
});
