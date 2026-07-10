import {
  firstValidationError,
  optionalBoolean,
  optionalDate,
  optionalEnum,
  optionalHexColor,
  optionalRequiredString,
  optionalString,
  requiredString,
} from "@/lib/apiValidation";

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"];
export const PROJECT_TYPES = ["work", "learning", "personal"];

function validateDateOrder(startDate, endDate) {
  if (!startDate || !endDate) return null;
  if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
    return "Start date must be before end date";
  }
  return null;
}

export function validateProjectCreateBody(body) {
  const name = requiredString(body.name, "Name", { max: 255 });
  const description = optionalString(body.description, "Description", { max: 10000 });
  const color = optionalHexColor(body.color, "Color");
  const status = optionalEnum(body.status, "Status", PROJECT_STATUSES);
  const type = optionalEnum(body.type, "Type", PROJECT_TYPES, { allowNull: true });
  const startDate = optionalDate(body.startDate, "Start date");
  const endDate = optionalDate(body.endDate, "End date");

  const error =
    firstValidationError(name, description, color, status, type, startDate, endDate) ||
    validateDateOrder(startDate.value, endDate.value);
  if (error) return { error };

  return {
    value: {
      name: name.value,
      description: description.provided ? description.value : null,
      color: color.provided ? color.value || "#6366f1" : "#6366f1",
      status: status.provided ? status.value : "active",
      type: type.provided ? type.value : null,
      startDate: startDate.provided ? startDate.value : null,
      endDate: endDate.provided ? endDate.value : null,
    },
  };
}

export function validateProjectUpdateBody(body) {
  const name = optionalRequiredString(body.name, "Name", { max: 255 });
  const description = optionalString(body.description, "Description", { max: 10000 });
  const color = optionalHexColor(body.color, "Color");
  const status = optionalEnum(body.status, "Status", PROJECT_STATUSES);
  const type = optionalEnum(body.type, "Type", PROJECT_TYPES, { allowNull: true });
  const startDate = optionalDate(body.startDate, "Start date");
  const endDate = optionalDate(body.endDate, "End date");
  const isArchived = optionalBoolean(body.isArchived, "Archived");

  const error =
    firstValidationError(name, description, color, status, type, startDate, endDate, isArchived) ||
    validateDateOrder(startDate.value, endDate.value);
  if (error) return { error };

  const value = {};
  if (name.provided) value.name = name.value;
  if (description.provided) value.description = description.value;
  if (color.provided) value.color = color.value;
  if (status.provided) value.status = status.value;
  if (type.provided) value.type = type.value;
  if (startDate.provided) value.startDate = startDate.value;
  if (endDate.provided) value.endDate = endDate.value;
  if (isArchived.provided) value.isArchived = isArchived.value;

  return { value };
}
