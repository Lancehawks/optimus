import { withAuth, apiResponse } from "@/lib/apiUtils";
import { query } from "@/lib/db";

export const GET = withAuth(async (request) => {
  const result = await query(
    "SELECT google_email, created_at FROM google_connections WHERE user_id = $1",
    [request.user.id]
  );

  if (result.rows.length === 0) {
    return apiResponse({ connected: false, email: null, connectedAt: null });
  }

  return apiResponse({
    connected: true,
    email: result.rows[0].google_email,
    connectedAt: result.rows[0].created_at,
  });
});
