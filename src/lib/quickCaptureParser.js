const TYPE_PREFIXES = {
  task: [/^(task|todo|to do|reminder)\s*:?\s*/i, /^remind me to\s+/i],
  note: [/^(note|idea|journal)\s*:?\s*/i],
  event: [/^(event|calendar|schedule)\s*:?\s*/i],
  bookmark: [/^(bookmark|link|save link)\s*:?\s*/i],
};

const WEEKDAYS = [
  ["sunday", "sun"],
  ["monday", "mon"],
  ["tuesday", "tue", "tues"],
  ["wednesday", "wed"],
  ["thursday", "thu", "thur", "thurs"],
  ["friday", "fri"],
  ["saturday", "sat"],
];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateInputValue(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeUrl(url) {
  if (!url) return "";
  const cleanedUrl = url.replace(/[),.;]+$/g, "");
  if (/^https?:\/\//i.test(cleanedUrl)) return cleanedUrl;
  return `https://${cleanedUrl}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPrefix(input, type) {
  let text = input.trim();
  for (const pattern of TYPE_PREFIXES[type] || []) {
    text = text.replace(pattern, "");
  }
  return text.trim();
}

function detectExplicitType(input) {
  for (const [type, patterns] of Object.entries(TYPE_PREFIXES)) {
    if (patterns.some((pattern) => pattern.test(input))) return type;
  }
  return null;
}

function parsePriority(input) {
  const match = input.match(/\b(urgent|high|medium|low)(?:\s+priority)?\b/i);
  return match ? match[1].toLowerCase() : "medium";
}

function parseDate(input, now) {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  const isoMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    const [y, m, d] = isoMatch[1].split("-").map(Number);
    return { date: new Date(y, m - 1, d), match: isoMatch[0] };
  }

  if (/\btoday\b/i.test(input)) {
    return { date: base, match: input.match(/\btoday\b/i)[0] };
  }

  if (/\btomorrow\b/i.test(input)) {
    return { date: addDays(base, 1), match: input.match(/\btomorrow\b/i)[0] };
  }

  if (/\bnext week\b/i.test(input)) {
    return { date: addDays(base, 7), match: input.match(/\bnext week\b/i)[0] };
  }

  const weekdayMatch = input.match(/\b(next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
  if (weekdayMatch) {
    const [, nextWord, rawDay] = weekdayMatch;
    const dayIndex = WEEKDAYS.findIndex((aliases) =>
      aliases.includes(rawDay.toLowerCase())
    );
    const currentDay = base.getDay();
    let daysAhead = (dayIndex - currentDay + 7) % 7;
    if (nextWord || daysAhead === 0) daysAhead += 7;
    return { date: addDays(base, daysAhead), match: weekdayMatch[0] };
  }

  return { date: null, match: "" };
}

function parseTime(input) {
  const twelveHour = input.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2] || 0);
    const meridiem = twelveHour[3].toLowerCase();

    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    return {
      time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      match: twelveHour[0],
    };
  }

  const twentyFourHour = input.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (twentyFourHour) {
    return {
      time: `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`,
      match: twentyFourHour[0],
    };
  }

  return { time: "", match: "" };
}

function removeMatches(input, matches) {
  return matches
    .filter(Boolean)
    .reduce((text, match) => text.replace(new RegExp(escapeRegExp(match), "i"), " "), input)
    .replace(/\b(urgent|high|medium|low)(?:\s+priority)?\b/gi, " ")
    .replace(/\b(at|on|by)\s*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractUrl(input) {
  const match = input.match(/\b(https?:\/\/[^\s]+|www\.[^\s]+)\b/i);
  if (!match) return { url: "", match: "" };
  return { url: normalizeUrl(match[1]), match: match[0] };
}

function inferType(input, forcedType) {
  if (forcedType) return forcedType;

  const explicitType = detectExplicitType(input);
  if (explicitType) return explicitType;

  const { url } = extractUrl(input);
  if (url) return "bookmark";

  const hasDate = !!parseDate(input, new Date()).date;
  const hasTime = !!parseTime(input).time;
  if (/^\s*(meeting|call)\b/i.test(input) || (hasDate && hasTime)) {
    return "event";
  }

  return "task";
}

export function parseQuickCapture(input, options = {}) {
  const rawInput = (input || "").trim();
  const now = options.now || new Date();
  const type = inferType(rawInput, options.forcedType);
  const workingText = stripPrefix(rawInput, type);
  const datePart = parseDate(workingText, now);
  const timePart = parseTime(workingText);
  const priority = parsePriority(workingText);
  const urlPart = extractUrl(workingText);

  if (!rawInput) {
    const emptyType = options.forcedType || "task";
    return {
      type: emptyType,
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      eventDate: dateInputValue(now),
      eventTime: "",
      durationMinutes: 60,
      url: "",
      canShare: emptyType !== "bookmark",
    };
  }

  if (type === "bookmark") {
    const title = removeMatches(workingText, [urlPart.match]) || urlPart.url || workingText;
    return {
      type,
      title,
      description: "",
      priority: "medium",
      dueDate: "",
      eventDate: dateInputValue(now),
      eventTime: "",
      durationMinutes: 60,
      url: urlPart.url,
      canShare: false,
    };
  }

  const title = removeMatches(workingText, [datePart.match, timePart.match]) || workingText || "Untitled";

  return {
    type,
    title,
    description: "",
    priority,
    dueDate: type === "task" && datePart.date ? dateInputValue(datePart.date) : "",
    eventDate: dateInputValue(datePart.date || now),
    eventTime: type === "event" ? timePart.time : "",
    durationMinutes: 60,
    url: "",
    canShare: type !== "bookmark",
  };
}
