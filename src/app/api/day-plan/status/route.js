import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return apiError("date param is required");
    }

    const result = await query(
      "SELECT status FROM day_plan_logs WHERE user_id = $1 AND log_date = $2",
      [request.user.id, date]
    );

    return apiResponse({
      status: result.rows.length > 0 ? result.rows[0].status : null,
    });
  } catch (error) {
    console.error("Day plan status error:", error);
    return apiError("Internal server error", 500);
  }
});
