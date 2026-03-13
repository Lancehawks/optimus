/**
 * Merge class names conditionally (lightweight clsx alternative).
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a date to a readable string.
 */
export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...options,
  }).format(new Date(date));
}

/**
 * Get a YYYY-MM-DD string in the local timezone.
 * Avoids the UTC shift bug from toISOString().split("T")[0].
 *
 * Usage:
 *   toLocalDateStr()              → today in local tz
 *   toLocalDateStr(new Date())    → today in local tz
 *   toLocalDateStr(someDateObj)   → that date in local tz
 *   toLocalDateStr("2026-03-05")  → "2026-03-05" (passthrough for date-only strings)
 */
export function toLocalDateStr(input) {
  if (!input) {
    input = new Date();
  }
  // If it's already a YYYY-MM-DD string (no time component), return as-is
  if (typeof input === "string") {
    const dateOnly = input.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  }
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
