import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalBoolean, optionalHexColor, optionalString } from "@/lib/apiValidation";

export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;
  const result = await query(
    "SELECT * FROM calendars WHERE id = $1 AND user_id = $2",
    [id, request.user.id]
  );
  if (result.rows.length === 0) return apiError("Calendar not found", 404);
  return apiResponse({ calendar: result.rows[0] });
});

export const PUT = withAuth(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = optionalString(body.name, "Calendar name", { max: 100, emptyToNull: false });
  const color = optionalHexColor(body.color, "Color");
  const isDefault = optionalBoolean(body.is_default, "Default calendar");
  const validationError = firstValidationError(name, color, isDefault);
  if (validationError) return apiError(validationError);
  if (![name, color, isDefault].some((field) => field.provided)) return apiError("No fields to update");

  const result = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`calendars:${request.user.id}`]);
    const existing = await client.query(
      "SELECT id, is_default FROM calendars WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, request.user.id]
    );
    if (existing.rows.length === 0) return null;
    if (isDefault.provided && isDefault.value === false && existing.rows[0].is_default) {
      throw Object.assign(new Error("Choose another default calendar before unsetting this one"), { status: 400 });
    }
    if (isDefault.value === true) {
      await client.query("UPDATE calendars SET is_default = FALSE WHERE user_id = $1", [request.user.id]);
    }

    const fields = [];
    const values = [];
    let index = 1;
    if (name.provided) { fields.push(`name = $${index++}`); values.push(name.value); }
    if (color.provided) { fields.push(`color = $${index++}`); values.push(color.value); }
    if (isDefault.provided) { fields.push(`is_default = $${index++}`); values.push(isDefault.value); }
    fields.push("updated_at = NOW()");
    values.push(id, request.user.id);
    return client.query(
      `UPDATE calendars SET ${fields.join(", ")}
       WHERE id = $${index++} AND user_id = $${index}
       RETURNING *`,
      values
    );
  }).catch((error) => {
    if (error.status) return { error };
    throw error;
  });

  if (result?.error) return apiError(result.error.message, result.error.status);
  if (!result) return apiError("Calendar not found", 404);
  return apiResponse({ calendar: result.rows[0] });
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;
  const result = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`calendars:${request.user.id}`]);
    const target = await client.query(
      "SELECT id, is_default FROM calendars WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, request.user.id]
    );
    if (target.rows.length === 0) return { status: "missing" };
    const count = await client.query("SELECT COUNT(*)::int AS count FROM calendars WHERE user_id = $1", [request.user.id]);
    if (count.rows[0].count <= 1) return { status: "only" };

    await client.query("DELETE FROM calendars WHERE id = $1 AND user_id = $2", [id, request.user.id]);
    if (target.rows[0].is_default) {
      await client.query(
        `UPDATE calendars SET is_default = TRUE
         WHERE id = (
           SELECT id FROM calendars WHERE user_id = $1 ORDER BY created_at, id LIMIT 1
         )`,
        [request.user.id]
      );
    }
    return { status: "deleted" };
  });

  if (result.status === "missing") return apiError("Calendar not found", 404);
  if (result.status === "only") return apiError("Cannot delete your only calendar", 400);
  return apiResponse({ message: "Calendar deleted" });
});
