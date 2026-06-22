import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { markNotificationRead } from "@/lib/collaborationActivity";

export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const notification = await markNotificationRead(id, request.user.id);

    if (!notification) {
      return apiError("Notification not found", 404);
    }

    return apiResponse({ notification });
  } catch (error) {
    console.error("Notification read error:", error);
    return apiError("Internal server error", 500);
  }
});
