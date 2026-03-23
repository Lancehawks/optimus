import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { item_id, date, completed } = body;

    if (!item_id) {
      return apiError("item_id is required");
    }

    // Verify ownership through section
    const item = await query(
      `SELECT ci.id FROM checklist_items ci
       JOIN checklist_sections cs ON cs.id = ci.section_id
       WHERE ci.id = $1 AND cs.user_id = $2`,
      [item_id, request.user.id]
    );
    if (item.rows.length === 0) {
      return apiError("Item not found", 404);
    }

    const isCompleted = completed !== undefined ? completed : true;
    const logDate = date || null;

    let sql, sqlParams;
    if (logDate) {
      sql = `INSERT INTO checklist_logs (item_id, log_date, completed)
             VALUES ($1, $2, $3)
             ON CONFLICT (item_id, log_date)
             DO UPDATE SET completed = EXCLUDED.completed
             RETURNING *`;
      sqlParams = [item_id, logDate, isCompleted];
    } else {
      sql = `INSERT INTO checklist_logs (item_id, log_date, completed)
             VALUES ($1, CURRENT_DATE, $2)
             ON CONFLICT (item_id, log_date)
             DO UPDATE SET completed = EXCLUDED.completed
             RETURNING *`;
      sqlParams = [item_id, isCompleted];
    }

    const result = await query(sql, sqlParams);
    return apiResponse({ log: result.rows[0] }, 201);
  } catch (error) {
    console.error("Checklist log error:", error);
    return apiError("Internal server error", 500);
  }
});
