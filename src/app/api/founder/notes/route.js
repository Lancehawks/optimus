import { createFounderCollectionRoutes } from "@/lib/founderCollectionRoutes";
import { cleanText } from "@/lib/founderApi";

const MAX_BODY_LENGTH = 12000;

const routes = createFounderCollectionRoutes({
  table: "founder_notes",
  itemName: "note",
  listKey: "notes",
  listUnavailable: "Founder notes are temporarily unavailable",
  orderBy: "updated_at DESC",
  columns: [
    { name: "title", value: (note) => note.title },
    { name: "body", value: (note) => note.body },
  ],
  parse: (body) => ({
    title: cleanText(body.title, 160),
    body: cleanText(body.body, MAX_BODY_LENGTH),
  }),
  // Reject long notes outright: silently truncating a shared note loses work.
  validate: (note, body) => {
    if (typeof body.body === "string" && body.body.length > MAX_BODY_LENGTH) return "Note must be 12,000 characters or less";
    if (!note.title) return "Note title is required";
    if (!note.body) return "Write something before saving the note";
    return null;
  },
  present: (row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    updatedAt: row.updated_at,
    version: row.version,
  }),
});

export const GET = routes.GET;
export const POST = routes.POST;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
