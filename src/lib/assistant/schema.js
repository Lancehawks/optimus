// Validates a model's tool input against the small JSON Schema subset the
// assistant's tools use: an object of string, integer, boolean, array and nested
// object fields with enum, pattern, length, range and item-count limits. Unknown
// fields are rejected.

export class ToolInputError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dateField = (description) => ({ type: "string", format: "date", description });
export const uuidField = (description) => ({ type: "string", format: "uuid", description });

export function isRealDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function checkField(name, value, rule) {
  if (rule.type === "string") {
    if (typeof value !== "string") throw new ToolInputError(`${name} must be a string`);
    if (rule.enum && !rule.enum.includes(value)) {
      throw new ToolInputError(`${name} must be one of: ${rule.enum.join(", ")}`);
    }
    if (rule.format === "date" && !isRealDate(value)) throw new ToolInputError(`${name} must be a date as YYYY-MM-DD`);
    if (rule.format === "uuid" && !UUID_PATTERN.test(value)) throw new ToolInputError(`${name} must be an id returned by another tool`);
    if (rule.pattern && !new RegExp(rule.pattern).test(value.trim())) throw new ToolInputError(`${name}: ${rule.description}`);
    if (rule.minLength && value.trim().length < rule.minLength) {
      throw new ToolInputError(`${name} must be at least ${rule.minLength} characters`);
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      throw new ToolInputError(`${name} must be at most ${rule.maxLength} characters`);
    }
    return value.trim();
  }
  if (rule.type === "integer") {
    if (!Number.isInteger(value)) throw new ToolInputError(`${name} must be a whole number`);
    if (rule.minimum !== undefined && value < rule.minimum) throw new ToolInputError(`${name} must be at least ${rule.minimum}`);
    if (rule.maximum !== undefined && value > rule.maximum) throw new ToolInputError(`${name} must be at most ${rule.maximum}`);
    return value;
  }
  if (rule.type === "boolean") {
    if (typeof value !== "boolean") throw new ToolInputError(`${name} must be true or false`);
    return value;
  }
  if (rule.type === "array") {
    if (!Array.isArray(value)) throw new ToolInputError(`${name} must be a list`);
    if (rule.minItems && value.length < rule.minItems) throw new ToolInputError(`${name} needs at least ${rule.minItems} item(s)`);
    if (rule.maxItems && value.length > rule.maxItems) throw new ToolInputError(`${name} can have at most ${rule.maxItems} items`);
    return value.map((item, index) => checkField(`${name}[${index}]`, item, rule.items));
  }
  if (rule.type === "object") return validateToolInput(rule, value);
  throw new ToolInputError(`${name} has an unsupported type`);
}

export function validateToolInput(schema, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ToolInputError("Input must be an object");
  }
  const properties = schema.properties || {};
  for (const key of Object.keys(input)) {
    if (!(key in properties)) throw new ToolInputError(`Unknown field: ${key}`);
  }
  const value = {};
  for (const [name, rule] of Object.entries(properties)) {
    if (input[name] === undefined || input[name] === null) {
      if (schema.required?.includes(name)) throw new ToolInputError(`${name} is required`);
      continue;
    }
    value[name] = checkField(name, input[name], rule);
  }
  return value;
}
