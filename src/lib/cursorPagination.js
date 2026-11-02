const MAX_CURSOR_LENGTH = 2048;

export function encodeCursor(values) {
  return Buffer.from(JSON.stringify({ v: 1, ...values }), "utf8").toString("base64url");
}

export function decodeCursor(raw, requiredKeys = []) {
  if (!raw) return { value: null };
  if (raw.length > MAX_CURSOR_LENGTH) return { error: "Pagination cursor is invalid" };

  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!value || value.v !== 1 || requiredKeys.some((key) => value[key] === undefined)) {
      return { error: "Pagination cursor is invalid" };
    }
    return { value };
  } catch {
    return { error: "Pagination cursor is invalid" };
  }
}

export function readPageSize(searchParams, { fallback = 50, maximum = 100 } = {}) {
  const requested = Number.parseInt(searchParams.get("limit") || "", 10);
  if (!Number.isFinite(requested)) return fallback;
  return Math.min(Math.max(requested, 1), maximum);
}

export function finishCursorPage(rows, limit, cursorFromRow) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor(cursorFromRow(last)) : null,
    },
  };
}
