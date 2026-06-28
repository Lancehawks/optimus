import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { syncLiveNotifications } from "@/lib/notifications";
import { getNotificationPreferences } from "@/lib/notificationPreferenceStore";

export const POST = withAuth(async (request) => {
  try {
    const preferences = await getNotificationPreferences(request.user.id);
    const createdCount = await syncLiveNotifications(request.user.id, preferences);

    return apiResponse({ createdCount });
  } catch (error) {
    if (error.code === "42P01") {
      return apiResponse({ createdCount: 0 });
    }

    console.error("Notifications sync error:", error);
    return apiError("Internal server error", 500);
  }
});
