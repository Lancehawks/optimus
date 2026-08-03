export const notificationFilters = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export function isInvitationNotification(notification) {
  return notification.type === "project_invitation";
}

export function isUnreadNotification(notification) {
  return !notification.read_at;
}

export function getInvitationStatus(notification) {
  return notification.invitation?.status || notification.metadata?.status || "pending";
}

export function getInvitationId(notification) {
  return notification.invitation?.id || notification.metadata?.invitation_id || notification.entity_id || notification.id;
}

export function isPendingInvitationNotification(notification) {
  return isInvitationNotification(notification) && getInvitationStatus(notification) === "pending";
}

export function requiresNotificationAction(notification) {
  return isPendingInvitationNotification(notification);
}

export function getNotificationHref(notification) {
  if (notification.project?.id) {
    return `/projects?project_id=${notification.project.id}`;
  }

  if (notification.metadata?.href) {
    return notification.metadata.href;
  }

  if (notification.entity_type === "task") return "/tasks";
  if (notification.entity_type === "event") return "/calendar";
  return "/projects";
}

export function getNotificationActionLabel(notification) {
  if (notification.project?.id) return "Open project";
  if (notification.entity_type === "event") return "Open calendar";
  if (notification.entity_type === "task") return "Open tasks";
  return "Open";
}

export function getNotificationPerson(notification) {
  return isInvitationNotification(notification)
    ? notification.inviter
    : notification.actor;
}

export function getNotificationPersonName(notification) {
  const person = getNotificationPerson(notification);
  return person?.full_name || "Someone";
}

export function getNotificationHeadline(notification) {
  if (isInvitationNotification(notification)) {
    return `${getNotificationPersonName(notification)} invited you to collaborate`;
  }

  return `${getNotificationPersonName(notification)} ${notification.title}`;
}

export function getNotificationBody(notification) {
  if (isInvitationNotification(notification)) {
    const status = getInvitationStatus(notification);
    if (status === "accepted") {
      return notification.project?.name
        ? `You joined ${notification.project.name}.`
        : "Invitation accepted.";
    }
    if (status === "declined") {
      return notification.project?.name
        ? `You declined ${notification.project.name}.`
        : "Invitation declined.";
    }
    return notification.project?.name
      ? `Join ${notification.project.name} to see shared work.`
      : "Project invitation";
  }

  if (notification.project?.name) {
    return `${notification.body || "Project activity"} - ${notification.project.name}`;
  }

  return notification.body || "Project activity";
}
