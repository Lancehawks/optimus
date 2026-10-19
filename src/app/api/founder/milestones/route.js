import { createFounderCollectionRoutes } from "@/lib/founderCollectionRoutes";
import { cleanText, optionalDate } from "@/lib/founderApi";

const STATUSES = new Set(["planned", "active", "achieved"]);

const routes = createFounderCollectionRoutes({
  table: "founder_milestones",
  itemName: "milestone",
  listKey: "milestones",
  listUnavailable: "Company milestones are temporarily unavailable",
  orderBy: "milestone_on ASC, created_at ASC",
  columns: [
    { name: "title", value: (item) => item.title },
    { name: "details", value: (item) => item.details || null },
    { name: "milestone_on", value: (item) => item.milestoneOn },
    { name: "status", value: (item) => item.status },
  ],
  parse: (body) => ({
    title: cleanText(body.title, 160),
    details: cleanText(body.details, 2000),
    milestoneOn: optionalDate(body.milestoneOn),
    status: cleanText(body.status, 20).toLowerCase() || "planned",
  }),
  validate: (item) => {
    if (!item.title) return "Milestone title is required";
    if (!item.milestoneOn) return "Choose a valid milestone date";
    if (!STATUSES.has(item.status)) return "Choose a valid milestone status";
    return null;
  },
  present: (row) => ({
    id: row.id,
    title: row.title,
    details: row.details || "",
    milestoneOn: row.milestone_on,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  }),
});

export const GET = routes.GET;
export const POST = routes.POST;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
