import { hasFounderAccess } from "./founderAccess";
import { apiError, apiUnavailable, withAuth } from "./apiUtils";

export function withFounderRoomAccess(handler) {
  return withAuth(async (request, context) => {
    let unlocked;
    try {
      unlocked = await hasFounderAccess(request.user.id);
    } catch (error) {
      console.error("Founder Lobby access check error:", error);
      return apiUnavailable("Founder Lobby is temporarily unavailable");
    }

    if (!unlocked) return apiError("Founder Lobby is locked", 403);
    return handler(request, context);
  });
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function optionalDate(value) {
  if (value === null || value === "" || value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== String(value)) {
    return undefined;
  }
  return String(value);
}

export { numericValue } from './founderValues';
