import { canEditEventStatus, sanitizeEventForViewer } from "@/lib/eventSecurity";
import { getProjectForMember } from "@/lib/projectAccess";

export { canEditEventStatus, sanitizeEventForViewer };

export function isEventCreator(event, userId) {
  return Boolean(event?.user_id && event.user_id === userId);
}

export function canMoveEventToPersonal(event, userId) {
  return isEventCreator(event, userId);
}

export async function findProjectForEventMember(userId, projectId) {
  return getProjectForMember(userId, projectId);
}
