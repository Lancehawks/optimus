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
