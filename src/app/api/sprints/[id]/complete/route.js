import { transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { optionalUuid, parseJsonObject } from "@/lib/apiValidation";
import { completeSprint } from "@/lib/sprints";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Sprint", { allowNull: false }).error) return apiError("Sprint ID is invalid");

    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const carryOver = optionalUuid(body.carryOverSprintId, "Sprint");
    if (carryOver.error) return apiError(carryOver.error);

    const result = await transaction((client) => completeSprint(client, request.user.id, id, {
      carryOverSprintId: carryOver.provided ? carryOver.value : null,
    }));
    if (result.error) return apiError(result.error, result.status);
    return apiResponse({ sprint: result.sprint });
  } catch (error) {
    console.error("Sprint complete error:", error);
    return apiError("Internal server error", 500);
  }
});
