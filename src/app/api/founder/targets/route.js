import { createFounderCollectionRoutes } from "@/lib/founderCollectionRoutes";
import { cleanText, numericValue, optionalDate } from "@/lib/founderApi";

const STATUSES = new Set(["active", "achieved", "paused"]);
const MAX_VALUE = 999999999999;

const routes = createFounderCollectionRoutes({
  table: "founder_targets",
  itemName: "target",
  listKey: "targets",
  listUnavailable: "Company targets are temporarily unavailable",
  orderBy: `CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
    deadline ASC NULLS LAST, created_at ASC`,
  columns: [
    { name: "title", value: (item) => item.title },
    { name: "current_value", value: (item) => item.currentValue },
    { name: "target_value", value: (item) => item.targetValue },
    { name: "unit", value: (item) => item.unit },
    { name: "deadline", value: (item) => item.deadline },
    { name: "status", value: (item) => item.status },
  ],
  parse: (body) => ({
    title: cleanText(body.title, 160),
    currentValue: numericValue(body.currentValue),
    targetValue: numericValue(body.targetValue),
    unit: cleanText(body.unit, 24),
    deadline: optionalDate(body.deadline),
    status: cleanText(body.status, 20).toLowerCase() || "active",
  }),
  validate: (item) => {
    if (!item.title) return "Target title is required";
    if (item.currentValue === null || item.currentValue < 0 || item.currentValue > MAX_VALUE) return `Choose a current value between 0 and ${MAX_VALUE}`;
    if (item.targetValue === null || item.targetValue <= 0 || item.targetValue > MAX_VALUE) return `Target value must be greater than zero and at most ${MAX_VALUE}`;
    if (item.deadline === undefined) return "Choose a valid target deadline";
    if (!STATUSES.has(item.status)) return "Choose a valid target status";
    return null;
  },
  present: (row) => ({
    id: row.id,
    title: row.title,
    currentValue: Number(row.current_value),
    targetValue: Number(row.target_value),
    unit: row.unit || "",
    deadline: row.deadline,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  }),
});

export const GET = routes.GET;
export const POST = routes.POST;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
