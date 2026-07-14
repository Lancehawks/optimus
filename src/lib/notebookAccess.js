import { query } from "@/lib/db";

export async function userOwnsNotebook(userId, notebookId) {
  if (!notebookId) return true;

  const result = await query(
    "SELECT 1 FROM notebooks WHERE id = $1 AND user_id = $2 LIMIT 1",
    [notebookId, userId]
  );
  return result.rows.length > 0;
}
