// Formatters are created once: Intl constructors are expensive and several of
// these run on every render (and the countdown re-renders every second).
const MEDIUM_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const LONG_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });
const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" });
const NUMBER_FORMAT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

// Calendar dates (YYYY-MM-DD) are shown in local time, never shifted by UTC.
function formatCalendarDate(value, format) {
  if (!value) return "No date";
  return format.format(new Date(`${value}T00:00:00`));
}

export function formatDate(value) {
  return formatCalendarDate(value, MEDIUM_DATE);
}

export function formatLongDate(value) {
  return formatCalendarDate(value, LONG_DATE);
}

export function formatTimestampDate(value) {
  return MEDIUM_DATE.format(new Date(value));
}

export function formatDateTime(value) {
  return DATE_TIME.format(new Date(value));
}

export function formatNumber(value) {
  return NUMBER_FORMAT.format(Number(value || 0));
}

export function padIndex(index) {
  return String(index + 1).padStart(2, "0");
}

export function padNumber(value) {
  return String(value).padStart(2, "0");
}

export function capitalize(value) {
  return value[0].toUpperCase() + value.slice(1);
}

export function firstNameOf(userName) {
  return String(userName || "Founder").trim().split(/\s+/)[0];
}
