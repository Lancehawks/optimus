import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { optionalUuid } from "@/lib/apiValidation";
import { startSprint } from "@/lib/sprints";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Sprint", { allowNull: false }).error) return apiError("Sprint ID is invalid");

    const result = await startSprint({ query }, request.user.id, id);
    if (result.error) return apiError(result.error, result.status);
    return apiResponse({ sprint: result.sprint });
  } catch (error) {
    console.error("Sprint start error:", error);
    return apiError("Internal server error", 500);
  }
});
