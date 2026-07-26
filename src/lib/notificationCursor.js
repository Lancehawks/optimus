import { decodeCursor } from "./cursorPagination.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INVALID_CURSOR_ERROR = "Pagination cursor is invalid";

function isCanonicalIsoDateTime(value) {
  if (typeof value !== "string") return false;

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

export function decodeNotificationCursor(raw, status) {
  const decoded = decodeCursor(raw, ["createdAt", "id", "status"]);
  if (decoded.error || !decoded.value) return decoded;

  const { createdAt, id, status: cursorStatus } = decoded.value;
  if (
    !isCanonicalIsoDateTime(createdAt) ||
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof cursorStatus !== "string"
  ) {
    return { error: INVALID_CURSOR_ERROR };
  }

  if (cursorStatus !== status) {
    return { error: "Pagination cursor does not match the requested status" };
  }

  return { value: { createdAt, id } };
}
