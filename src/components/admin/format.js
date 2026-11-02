// Assistant costs are often fractions of a cent, so small amounts keep four
// decimals instead of rounding to "$0.00".
export function formatUsd(value) {
  const amount = Number(value) || 0;
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatCompact(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

export function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

export function formatDay(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

// "2026-10-22" as a UTC calendar day, without a timezone shift.
export function formatUtcDay(key, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}
