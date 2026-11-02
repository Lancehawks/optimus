// Tasks store one number, estimated_minutes; people enter hours and minutes.
export const MAX_ESTIMATE_MINUTES = 60000;
export const MAX_ESTIMATE_MESSAGE = "Time estimate can't be more than 1,000 hours";

export function cleanEstimateInput(value) {
  return String(value).replace(/\D/g, "").slice(0, 3);
}

/** Total minutes from the two fields, or null when both are empty or zero. "90" minutes is 1h 30m. */
export function estimateToMinutes(hours, minutes) {
  const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  return total > 0 ? total : null;
}

/** Field values for a stored estimate. A zero part stays empty, so the placeholder shows. */
export function minutesToEstimate(total) {
  const hours = Math.floor((total || 0) / 60);
  const minutes = (total || 0) % 60;
  return { hours: hours ? String(hours) : "", minutes: minutes ? String(minutes) : "" };
}

export function formatEstimate(total) {
  if (!total) return "";
  const { hours, minutes } = minutesToEstimate(total);
  return [hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(" ");
}
