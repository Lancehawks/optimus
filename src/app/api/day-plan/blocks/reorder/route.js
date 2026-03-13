import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { orderedIds } = body;

    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return apiError("orderedIds array is required");
    }

    // Verify all blocks belong to user
    const check = await query(
      "SELECT id FROM day_plan_blocks WHERE id = ANY($1) AND user_id = $2",
      [orderedIds, request.user.id]
    );
    if (check.rows.length !== orderedIds.length) {
      return apiError("Some blocks not found", 404);
    }

    // Update positions
    for (let i = 0; i < orderedIds.length; i++) {
      await query(
        "UPDATE day_plan_blocks SET position = $1 WHERE id = $2",
        [i, orderedIds[i]]
      );
    }

    return apiResponse({ success: true });
  } catch (error) {
    console.error("Day plan reorder error:", error);
    return apiError("Internal server error", 500);
  }
});
