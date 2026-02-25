const DAY_ABBR = {
  SU: "Sun",
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
};

const DAY_RRULE = {
  Sun: "SU",
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
};

/**
 * Convert Google RRULE array to app recurrence_rule format.
 * Returns null for unsupported patterns.
 */
export function rruleToAppFormat(rruleArray) {
  if (!rruleArray || rruleArray.length === 0) return null;

  const rruleLine = rruleArray.find((r) => r.startsWith("RRULE:"));
  if (!rruleLine) return null;

  const parts = Object.fromEntries(
    rruleLine
      .replace("RRULE:", "")
      .split(";")
      .map((p) => p.split("="))
  );

  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL) : 1;

  if (parts.FREQ === "DAILY" && !parts.BYDAY && interval === 1) return "daily";
  if (parts.FREQ === "WEEKLY" && !parts.BYDAY && interval === 1)
    return "weekly";
  if (parts.FREQ === "MONTHLY" && interval === 1) return "monthly";
  if (parts.FREQ === "YEARLY" && interval === 1) return "yearly";

  if (parts.FREQ === "WEEKLY" && parts.BYDAY) {
    const days = parts.BYDAY.split(",")
      .map((d) => DAY_ABBR[d])
      .filter(Boolean);
    if (days.length > 0) return `custom:${days.join(",")}`;
  }

  return null;
}

/**
 * Convert app recurrence_rule to Google RRULE array.
 */
export function appFormatToRrule(rule) {
  if (!rule) return undefined;
  if (rule === "daily") return ["RRULE:FREQ=DAILY"];
  if (rule === "weekly") return ["RRULE:FREQ=WEEKLY"];
  if (rule === "monthly") return ["RRULE:FREQ=MONTHLY"];
  if (rule === "yearly") return ["RRULE:FREQ=YEARLY"];

  if (rule.startsWith("custom:")) {
    const days = rule
      .slice(7)
      .split(",")
      .map((d) => DAY_RRULE[d.trim()])
      .filter(Boolean);
    if (days.length > 0) return [`RRULE:FREQ=WEEKLY;BYDAY=${days.join(",")}`];
  }

  return undefined;
}
