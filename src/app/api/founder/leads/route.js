import { createFounderCollectionRoutes } from "@/lib/founderCollectionRoutes";
import { cleanText, numericValue, optionalDate } from "@/lib/founderApi";

const STAGES = new Set(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]);
const MAX_VALUE = 999999999999;

const routes = createFounderCollectionRoutes({
  table: "founder_leads",
  itemName: "lead",
  listKey: "leads",
  listUnavailable: "Client leads are temporarily unavailable",
  orderBy: `CASE stage
      WHEN 'negotiation' THEN 0 WHEN 'proposal' THEN 1 WHEN 'qualified' THEN 2
      WHEN 'contacted' THEN 3 WHEN 'new' THEN 4 WHEN 'won' THEN 5 ELSE 6 END,
    follow_up_on ASC NULLS LAST, updated_at DESC`,
  columns: [
    { name: "client_name", value: (item) => item.clientName },
    { name: "company", value: (item) => item.company || null },
    { name: "email", value: (item) => item.email || null },
    { name: "owner", value: (item) => item.owner || null },
    { name: "stage", value: (item) => item.stage },
    { name: "value", value: (item) => item.value },
    { name: "follow_up_on", value: (item) => item.followUpOn },
    { name: "notes", value: (item) => item.notes || null },
  ],
  parse: (body) => ({
    clientName: cleanText(body.clientName, 160),
    company: cleanText(body.company, 160),
    email: cleanText(body.email, 255).toLowerCase(),
    owner: cleanText(body.owner, 120),
    stage: cleanText(body.stage, 24).toLowerCase() || "new",
    value: numericValue(body.value),
    followUpOn: optionalDate(body.followUpOn),
    notes: cleanText(body.notes, 4000),
  }),
  validate: (item) => {
    if (!item.clientName) return "Client or lead name is required";
    if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) return "Enter a valid email address";
    if (!STAGES.has(item.stage)) return "Choose a valid lead stage";
    if (item.value === null || item.value < 0 || item.value > MAX_VALUE) return "Choose a valid lead value";
    if (item.followUpOn === undefined) return "Choose a valid follow-up date";
    return null;
  },
  present: (row) => ({
    id: row.id,
    clientName: row.client_name,
    company: row.company || "",
    email: row.email || "",
    owner: row.owner || "",
    stage: row.stage,
    value: Number(row.value || 0),
    followUpOn: row.follow_up_on,
    notes: row.notes || "",
    updatedAt: row.updated_at,
    version: row.version,
  }),
});

export const GET = routes.GET;
export const POST = routes.POST;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
