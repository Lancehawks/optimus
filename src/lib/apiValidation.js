const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function parseJsonObject(request) {
  try {
    const body = await request.json();
    if (!isPlainObject(body)) {
      return { error: "Request body must be an object" };
    }
    return { data: body };
  } catch {
    return { error: "Invalid JSON body" };
  }
}

export function firstValidationError(...results) {
  return results.find((result) => result?.error)?.error || null;
}

export function requiredString(value, label, { max = 255 } = {}) {
  if (typeof value !== "string") {
    return { error: `${label} is required` };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { error: `${label} is required` };
  }
  if (normalized.length > max) {
    return { error: `${label} must be ${max} characters or less` };
  }

  return { value: normalized };
}

export function optionalRequiredString(value, label, { max = 255 } = {}) {
  if (value === undefined) return { provided: false };

  const result = requiredString(value, label, { max });
  if (result.error) return result;
  return { provided: true, value: result.value };
}

export function optionalString(value, label, { max = 255, emptyToNull = true, trim = true } = {}) {
  if (value === undefined) return { provided: false };
  if (value === null) return { provided: true, value: null };
  if (typeof value !== "string") {
    return { error: `${label} must be text` };
  }

  const normalized = trim ? value.trim() : value;
  if (normalized === "" && emptyToNull) {
    return { provided: true, value: null };
  }
  if (normalized.length > max) {
    return { error: `${label} must be ${max} characters or less` };
  }

  return { provided: true, value: normalized };
}

export function optionalEnum(value, label, allowedValues, { allowNull = false } = {}) {
  if (value === undefined) return { provided: false };
  if (value === null || value === "") {
    if (allowNull) return { provided: true, value: null };
    return { error: `${label} is required` };
  }
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    return { error: `${label} must be one of: ${allowedValues.join(", ")}` };
  }
  return { provided: true, value };
}

export function optionalBoolean(value, label) {
  if (value === undefined) return { provided: false };
  if (typeof value !== "boolean") {
    return { error: `${label} must be true or false` };
  }
  return { provided: true, value };
}

export function optionalInteger(value, label, { min = null, max = null } = {}) {
  if (value === undefined) return { provided: false };
  if (!Number.isInteger(value)) {
    return { error: `${label} must be an integer` };
  }
  if (min !== null && value < min) {
    return { error: `${label} must be at least ${min}` };
  }
  if (max !== null && value > max) {
    return { error: `${label} must be at most ${max}` };
  }
  return { provided: true, value };
}

export function optionalDate(value, label) {
  if (value === undefined) return { provided: false };
  if (value === null || value === "") {
    return { provided: true, value: null };
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return { error: `${label} must be a valid date` };
  }
  return { provided: true, value };
}

export function optionalUuid(value, label, { allowNull = true } = {}) {
  if (value === undefined) return { provided: false };
  if (value === null || value === "") {
    if (allowNull) return { provided: true, value: null };
    return { error: `${label} is required` };
  }
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return { error: `${label} must be a valid ID` };
  }
  return { provided: true, value };
}

export function uuidArray(value, label, { required = false, max = 100 } = {}) {
  if (value === undefined) {
    return required ? { error: `${label} is required` } : { provided: false };
  }
  if (!Array.isArray(value)) {
    return { error: `${label} must be an array` };
  }
  if (value.length > max) {
    return { error: `${label} can include at most ${max} items` };
  }

  const ids = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !UUID_PATTERN.test(item)) {
      return { error: `${label} must contain only valid IDs` };
    }
    if (!seen.has(item)) {
      seen.add(item);
      ids.push(item);
    }
  }

  return { provided: true, value: ids };
}

export function optionalHexColor(value, label) {
  if (value === undefined) return { provided: false };
  if (value === null || value === "") {
    return { provided: true, value: null };
  }
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
    return { error: `${label} must be a hex color like #0d6b88` };
  }
  return { provided: true, value: value.toLowerCase() };
}
