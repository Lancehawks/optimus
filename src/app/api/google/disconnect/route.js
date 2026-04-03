import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { query } from "@/lib/db";

export const POST = withAuth(async (request) => {
  const conn = await query(
    "SELECT id FROM google_connections WHERE user_id = $1",
    [request.user.id]
  );

  if (conn.rows.length === 0) {
    return apiError("Google not connected", 400);
  }

  // Delete connection
  await query("DELETE FROM google_connections WHERE user_id = $1", [
    request.user.id,
  ]);

  // Delete all Google calendars (cascade deletes their events)
  await query(
    "DELETE FROM calendars WHERE user_id = $1 AND is_google = true",
    [request.user.id]
  );

  // Restore default to first local calendar
  await query(
    `UPDATE calendars SET is_default = true
     WHERE id = (
       SELECT id FROM calendars WHERE user_id = $1 AND (is_google = false OR is_google IS NULL)
       ORDER BY created_at ASC LIMIT 1
     )`,
    [request.user.id]
  );

  return apiResponse({ message: "Google account disconnected" });
});
