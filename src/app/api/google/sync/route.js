import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { query } from "@/lib/db";
import { calendarSyncJob } from "@/lib/integrationJobs";

export const POST = withAuth(async (request) => {
  const conn = await query(
    "SELECT id FROM google_connections WHERE user_id = $1",
    [request.user.id]
  );

  if (conn.rows.length === 0) {
    return apiError("Google not connected", 400);
  }

  const job = await calendarSyncJob({ userId: request.user.id, source: "manual" });
  return apiResponse({ message: "Sync queued", job }, 202);
});
