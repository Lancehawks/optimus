import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { listProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember } from "@/lib/projectAccess";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const project = await getProjectForMember(request.user.id, id);
    if (!project) {
      return apiError("Project not found", 404);
    }

    const activity = await listProjectActivity(id, request.user.id);
    return apiResponse({ activity });
  } catch (error) {
    if (error.code === "42P01") {
      return apiResponse({ activity: [] });
    }

    console.error("Project activity list error:", error);
    return apiError("Internal server error", 500);
  }
});
