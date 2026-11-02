import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { logRoutineItem } from "@/lib/routineLogs";

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { item_id, date, completed } = body;

    if (!item_id) {
      return apiError("item_id is required");
    }

    // Verify ownership through section
    const item = await query(
      `SELECT ci.id FROM checklist_items ci
       JOIN checklist_sections cs ON cs.id = ci.section_id
       WHERE ci.id = $1 AND cs.user_id = $2`,
      [item_id, request.user.id]
    );
    if (item.rows.length === 0) {
      return apiError("Item not found", 404);
    }

    const log = await logRoutineItem({ query }, request.user, { itemId: item_id, date, completed });
    return apiResponse({ log }, 201);
  } catch (error) {
    console.error("Checklist log error:", error);
    return apiError("Internal server error", 500);
  }
});
