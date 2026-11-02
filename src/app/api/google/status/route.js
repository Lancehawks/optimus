import { withAuth, apiResponse } from "@/lib/apiUtils";
import { query } from "@/lib/db";

export const GET = withAuth(async (request) => {
  const result = await query(
    `SELECT connection.google_email, connection.created_at,
            MAX(calendar.last_synced_at) AS last_synced_at
     FROM google_connections connection
     LEFT JOIN calendars calendar ON calendar.user_id = connection.user_id
       AND calendar.is_google = TRUE
     WHERE connection.user_id = $1
     GROUP BY connection.google_email, connection.created_at`,
    [request.user.id]
  );

  if (result.rows.length === 0) {
    return apiResponse({ connected: false, email: null, connectedAt: null });
  }

  return apiResponse({
    connected: true,
    email: result.rows[0].google_email,
    connectedAt: result.rows[0].created_at,
    lastSyncedAt: result.rows[0].last_synced_at,
  });
});
