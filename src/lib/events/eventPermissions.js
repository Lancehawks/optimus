import { canEditEventStatus, sanitizeEventForViewer } from "@/lib/eventSecurity";
import { getProjectForMember, isProjectOwner } from "@/lib/projectAccess";

export { canEditEventStatus, sanitizeEventForViewer };

export function isEventCreator(event, userId) {
  return Boolean(event?.user_id && event.user_id === userId);
}

export function canMoveEventToPersonal(event, userId) {
  return isEventCreator(event, userId);
}

export async function canDeleteEvent(event, userId) {
  if (!event?.project_id) return isEventCreator(event, userId);
  return isProjectOwner(userId, event.project_id);
}

export async function findProjectForEventMember(userId, projectId) {
  return getProjectForMember(userId, projectId);
}
