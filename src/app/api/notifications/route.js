import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import {
  countUnreadNotifications,
  listNotifications,
  listUnreadNotifications,
  markNotificationsRead,
} from "@/lib/notifications";
import { decodeNotificationCursor } from "@/lib/notificationCursor";
import { getNotificationPreferences } from "@/lib/notificationPreferenceStore";
import {
  finishCursorPage,
  readPageSize,
} from "@/lib/cursorPagination";
import { normalizeNotificationStatus } from "@/lib/notifications/notificationSql";

export const GET = withAuth(async (request) => {
  let responseLimit = 50;

  try {
    const { searchParams } = new URL(request.url);
    const status = normalizeNotificationStatus(
      searchParams.get("status") || "unread"
    );
    const isHistoryRequest = status !== "unread";
    const limit = readPageSize(searchParams, {
      fallback: isHistoryRequest ? 50 : 30,
      maximum: 100,
    });
    responseLimit = limit;
    const cursor = decodeNotificationCursor(
      searchParams.get("cursor"),
      status
    );
    if (cursor.error) return apiError(cursor.error);

    const preferences = await getNotificationPreferences(request.user.id);

    const [
      notificationRows,
      unreadActivityCount,
    ] = await Promise.all([
      isHistoryRequest
        ? listNotifications(request.user.id, {
            status,
            limit,
            preferences,
            cursor: cursor.value,
            includeLookahead: true,
          })
        : listUnreadNotifications(request.user.id, {
            limit,
            preferences,
            cursor: cursor.value,
            includeLookahead: true,
          }),
      countUnreadNotifications(request.user.id, preferences),
    ]);

    const page = finishCursorPage(notificationRows, limit, (notification) => ({
      status,
      createdAt: notification.created_at,
      id: notification.id,
    }));
    const notifications = page.items.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entity_type: notification.entity_type,
      entity_id: notification.entity_id,
      metadata: notification.metadata || {},
      read_at: notification.read_at,
      created_at: notification.created_at,
      project: notification.project_id
        ? {
            id: notification.project_id,
            name: notification.project_name,
            color: notification.project_color,
          }
        : null,
      invitation: notification.type === "project_invitation"
        ? {
            id: notification.metadata?.invitation_id || notification.entity_id,
            status: notification.metadata?.status || "pending",
          }
        : null,
      inviter: notification.type === "project_invitation" && notification.actor_id
        ? {
            id: notification.actor_id,
            full_name: notification.actor_full_name,
            avatar_url: notification.actor_avatar_url,
          }
        : null,
      actor: notification.actor_id
        ? {
            id: notification.actor_id,
            full_name: notification.actor_full_name,
            avatar_url: notification.actor_avatar_url,
          }
        : null,
    }));

    return apiResponse({
      notifications,
      unreadCount: unreadActivityCount,
      preferences,
      pagination: page.pagination,
    });
  } catch (error) {
    if (error.code === "42P01") {
      return apiResponse({
        notifications: [],
        unreadCount: 0,
        pagination: {
          limit: responseLimit,
          hasMore: false,
          nextCursor: null,
        },
      });
    }

    console.error("Notifications list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PATCH = withAuth(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      return apiError("Notification ids are required", 400);
    }

    const notifications = await markNotificationsRead(ids, request.user.id);

    return apiResponse({
      ids: notifications.map((notification) => notification.id),
    });
  } catch (error) {
    if (error.code === "42P01") {
      return apiResponse({ ids: [] });
    }

    console.error("Notifications mark read error:", error);
    return apiError("Internal server error", 500);
  }
});
