import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  const { id } = await params;

  const result = await query(
    "SELECT * FROM calendars WHERE id = $1 AND user_id = $2",
    [id, request.user.id]
  );

  if (result.rows.length === 0) {
    return apiError("Calendar not found", 404);
  }

  return apiResponse({ calendar: result.rows[0] });
});

export const PUT = withAuth(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const { name, color, is_default } = body;

  const existing = await query(
    "SELECT id FROM calendars WHERE id = $1 AND user_id = $2",
    [id, request.user.id]
  );
  if (existing.rows.length === 0) {
    return apiError("Calendar not found", 404);
  }

  // If setting as default, unset all others first
  if (is_default === true) {
    await query(
      "UPDATE calendars SET is_default = false WHERE user_id = $1",
      [request.user.id]
    );
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(name.trim());
  }
  if (color !== undefined) {
    fields.push(`color = $${paramIndex++}`);
    values.push(color);
  }
  if (is_default !== undefined) {
    fields.push(`is_default = $${paramIndex++}`);
    values.push(is_default);
  }

  if (fields.length === 0) {
    return apiError("No fields to update");
  }

  fields.push(`updated_at = NOW()`);
  values.push(id, request.user.id);

  const result = await query(
    `UPDATE calendars SET ${fields.join(", ")}
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return apiResponse({ calendar: result.rows[0] });
});

export const DELETE = withAuth(async (request, { params }) => {
  const { id } = await params;

  // Prevent deleting the last calendar
  const countResult = await query(
    "SELECT COUNT(*)::int AS count FROM calendars WHERE user_id = $1",
    [request.user.id]
  );
  if (countResult.rows[0].count <= 1) {
    return apiError("Cannot delete your only calendar", 400);
  }

  const result = await query(
    "DELETE FROM calendars WHERE id = $1 AND user_id = $2 RETURNING id, is_default",
    [id, request.user.id]
  );

  if (result.rows.length === 0) {
    return apiError("Calendar not found", 404);
  }

  // If we deleted the default, make another one default
  if (result.rows[0].is_default) {
    await query(
      `UPDATE calendars SET is_default = true
       WHERE user_id = $1
       ORDER BY created_at ASC LIMIT 1`,
      [request.user.id]
    );
  }

  return apiResponse({ message: "Calendar deleted" });
});
