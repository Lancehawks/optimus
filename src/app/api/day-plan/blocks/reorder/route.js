import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { uuidArray } from "@/lib/apiValidation";

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { orderedIds } = body;

    const idsResult = uuidArray(orderedIds, "orderedIds", { required: true, max: 100 });
    if (idsResult.error || idsResult.value.length === 0) return apiError(idsResult.error || "orderedIds is required");

    const result = await query(
      `WITH requested AS (
         SELECT id, ordinality - 1 AS position
         FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(id, ordinality)
       ), updated AS (
         UPDATE day_plan_blocks blocks
         SET position = requested.position, updated_at = NOW()
         FROM requested
         WHERE blocks.id = requested.id AND blocks.user_id = $2
         RETURNING blocks.id
       )
       SELECT COUNT(*)::int AS count FROM updated`,
      [idsResult.value, request.user.id]
    );
    if (result.rows[0].count !== idsResult.value.length) {
      return apiError("Some blocks not found", 404);
    }

    return apiResponse({ success: true });
  } catch (error) {
    console.error("Day plan reorder error:", error);
    return apiError("Internal server error", 500);
  }
});
