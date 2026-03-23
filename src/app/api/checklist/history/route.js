import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return apiError("start and end date params are required");
    }

    const logs = await query(
      `SELECT cl.item_id, cl.log_date, cl.completed
       FROM checklist_logs cl
       JOIN checklist_items ci ON ci.id = cl.item_id
       JOIN checklist_sections cs ON cs.id = ci.section_id
       WHERE cs.user_id = $1 AND cl.log_date >= $2 AND cl.log_date <= $3
       ORDER BY cl.log_date ASC`,
      [request.user.id, start, end]
    );

    return apiResponse({ logs: logs.rows });
  } catch (error) {
    console.error("Checklist history error:", error);
    return apiError("Internal server error", 500);
  }
});
