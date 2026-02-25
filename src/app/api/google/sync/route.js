import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { query } from "@/lib/db";
import { importGoogleCalendars, syncGoogleEvents } from "@/lib/googleSync";

export const POST = withAuth(async (request) => {
  const conn = await query(
    "SELECT id FROM google_connections WHERE user_id = $1",
    [request.user.id]
  );

  if (conn.rows.length === 0) {
    return apiError("Google not connected", 400);
  }

  try {
    const calendarIds = await importGoogleCalendars(request.user.id);
    let totalSynced = 0;

    for (const calId of calendarIds) {
      const result = await syncGoogleEvents(request.user.id, calId);
      totalSynced += result.synced;
    }

    return apiResponse({
      message: "Sync complete",
      calendarsImported: calendarIds.length,
      eventsSynced: totalSynced,
    });
  } catch (err) {
    console.error("Google sync error:", err);
    return apiError(err.message || "Sync failed", 500);
  }
});
