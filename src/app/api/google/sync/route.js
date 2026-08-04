import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { query } from "@/lib/db";
import { attemptGoogleCalendarSync } from "@/lib/events/googleEventSyncService";

export const maxDuration = 60;

export const POST = withAuth(async (request) => {
  const conn = await query(
    "SELECT id FROM google_connections WHERE user_id = $1",
    [request.user.id]
  );

  if (conn.rows.length === 0) {
    return apiError("Google not connected", 400);
  }

  const result = await attemptGoogleCalendarSync({ userId: request.user.id });

  const completed = result.googleSync === "completed";
  if (!completed) {
    return apiError(result.googleError || "Google Calendar sync failed", 502);
  }

  return apiResponse({
    message: "Google Calendar synced",
    ...result,
  });
});
