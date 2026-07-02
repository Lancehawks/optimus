import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notificationPreferenceStore";

export const GET = withAuth(async (request) => {
  try {
    const preferences = await getNotificationPreferences(request.user.id);
    return apiResponse({ preferences });
  } catch (error) {
    console.error("Notification preferences load error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const preferences = await updateNotificationPreferences(
      request.user.id,
      body.preferences
    );

    return apiResponse({ preferences });
  } catch (error) {
    console.error("Notification preferences update error:", error);
    return apiError("Internal server error", 500);
  }
});
