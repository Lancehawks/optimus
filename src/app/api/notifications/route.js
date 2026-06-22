import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { listUnreadNotifications } from "@/lib/collaborationActivity";
import { listPendingProjectInvitations } from "@/lib/projectAccess";

export const GET = withAuth(async (request) => {
  try {
    const [invitations, unreadNotifications] = await Promise.all([
      listPendingProjectInvitations(request.user.id),
      listUnreadNotifications(request.user.id),
    ]);

    const invitationNotifications = invitations.map((invitation) => ({
      id: invitation.id,
      type: "project_invitation",
      created_at: invitation.created_at,
      project: {
        id: invitation.project_id,
        name: invitation.project_name,
        description: invitation.project_description,
        color: invitation.project_color,
      },
      inviter: {
        id: invitation.inviter_id,
        email: invitation.inviter_email,
        full_name: invitation.inviter_full_name,
        avatar_url: invitation.inviter_avatar_url,
      },
    }));

    const activityNotifications = unreadNotifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entity_type: notification.entity_type,
      entity_id: notification.entity_id,
      metadata: notification.metadata || {},
      created_at: notification.created_at,
      project: notification.project_id
        ? {
            id: notification.project_id,
            name: notification.project_name,
            color: notification.project_color,
          }
        : null,
      actor: notification.actor_id
        ? {
            id: notification.actor_id,
            email: notification.actor_email,
            full_name: notification.actor_full_name,
            avatar_url: notification.actor_avatar_url,
          }
        : null,
    }));

    const notifications = [...invitationNotifications, ...activityNotifications]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return apiResponse({
      notifications,
      unreadCount: notifications.length,
    });
  } catch (error) {
    if (error.code === "42P01") {
      return apiResponse({ notifications: [], unreadCount: 0 });
    }

    console.error("Notifications list error:", error);
    return apiError("Internal server error", 500);
  }
});
