import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { date, completed, notes } = body;

    const habit = await query(
      "SELECT id FROM habits WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (habit.rows.length === 0) {
      return apiError("Habit not found", 404);
    }

    const logDate = date || null;
    const isCompleted = completed !== undefined ? completed : true;

    let sql;
    let sqlParams;

    if (logDate) {
      sql = `INSERT INTO habit_logs (habit_id, log_date, completed, notes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (habit_id, log_date)
             DO UPDATE SET completed = EXCLUDED.completed, notes = EXCLUDED.notes
             RETURNING *`;
      sqlParams = [id, logDate, isCompleted, notes || null];
    } else {
      sql = `INSERT INTO habit_logs (habit_id, log_date, completed, notes)
             VALUES ($1, CURRENT_DATE, $2, $3)
             ON CONFLICT (habit_id, log_date)
             DO UPDATE SET completed = EXCLUDED.completed, notes = EXCLUDED.notes
             RETURNING *`;
      sqlParams = [id, isCompleted, notes || null];
    }

    const result = await query(sql, sqlParams);

    return apiResponse({ log: result.rows[0] }, 201);
  } catch (error) {
    console.error("Habit log error:", error);
    return apiError("Internal server error", 500);
  }
});
