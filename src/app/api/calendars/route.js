import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  const result = await query(
    `SELECT *
     FROM calendars
     WHERE user_id = $1
     ORDER BY is_default DESC, COALESCE(is_google, false) ASC, name ASC`,
    [request.user.id]
  );

  return apiResponse({ calendars: result.rows });
});

export const POST = withAuth(async (request) => {
  const { name, color } = await request.json();

  if (!name || !name.trim()) {
    return apiError("Calendar name is required");
  }

  // Check if user has any calendars — if not, make this the default
  const existing = await query(
    "SELECT COUNT(*)::int AS count FROM calendars WHERE user_id = $1",
    [request.user.id]
  );
  const isDefault = existing.rows[0].count === 0;

  const result = await query(
    `INSERT INTO calendars (user_id, name, color, is_default)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [request.user.id, name.trim(), color || "#6366f1", isDefault]
  );

  return apiResponse({ calendar: result.rows[0] }, 201);
});
