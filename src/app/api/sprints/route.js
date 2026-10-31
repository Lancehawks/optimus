import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { createSprint, listSprints, validateSprintCreate } from "@/lib/sprints";

const db = { query };

export const GET = withAuth(async (request) => {
  try {
    return apiResponse({ sprints: await listSprints(db, request.user.id) });
  } catch (error) {
    console.error("Sprints list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateSprintCreate(body);
    if (validation.error) return apiError(validation.error);

    return apiResponse({ sprint: await createSprint(db, request.user.id, validation.value) }, 201);
  } catch (error) {
    console.error("Sprint create error:", error);
    return apiError("Internal server error", 500);
  }
});
