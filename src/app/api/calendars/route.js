import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { firstValidationError, optionalHexColor, requiredString } from "@/lib/apiValidation";

export const GET = withAuth(async (request) => {
  const result = await query(
    `SELECT * FROM calendars
     WHERE user_id = $1
     ORDER BY is_default DESC, COALESCE(is_google, false) ASC, name ASC`,
    [request.user.id]
  );
  return apiResponse({ calendars: result.rows });
});

export const POST = withAuth(async (request) => {
  const { name, color } = await request.json().catch(() => ({}));
  const nameResult = requiredString(name, "Calendar name", { max: 100 });
  const colorResult = optionalHexColor(color, "Color");
  const validationError = firstValidationError(nameResult, colorResult);
  if (validationError) return apiError(validationError);

  const result = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`calendars:${request.user.id}`]);
    const existing = await client.query(
      "SELECT EXISTS(SELECT 1 FROM calendars WHERE user_id = $1) AS exists",
      [request.user.id]
    );
    return client.query(
      `INSERT INTO calendars (user_id, name, color, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [request.user.id, nameResult.value, colorResult.value || "#0d6b88", !existing.rows[0].exists]
    );
  });

  return apiResponse({ calendar: result.rows[0] }, 201);
});
