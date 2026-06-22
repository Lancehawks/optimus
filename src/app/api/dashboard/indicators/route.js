import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { projectScopedAccessCondition } from "@/lib/projectAccess";

export const GET = withAuth(async (request) => {
  try {
    const userId = request.user.id;

    const overdueTasks = await query(
      `SELECT COUNT(*)::int AS count FROM tasks t
       WHERE ${projectScopedAccessCondition("t")}
         AND t.status != 'done'
         AND t.is_archived = false
         AND t.parent_task_id IS NULL
         AND t.due_date IS NOT NULL
         AND t.due_date::date < CURRENT_DATE`,
      [userId]
    );

    let habitsStatus = { rows: [{ total: 0, done_today: 0 }] };
    try {
      habitsStatus = await query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE EXISTS(
             SELECT 1 FROM habit_logs hl
             WHERE hl.habit_id = h.id AND hl.log_date = CURRENT_DATE AND hl.completed = true
           ))::int AS done_today
         FROM habits h
         WHERE h.user_id = $1 AND h.is_active = true`,
        [userId]
      );
    } catch (error) {
      if (error.code !== "42P01") throw error;
    }

    return apiResponse({
      indicators: {
        overdueTaskCount: overdueTasks.rows[0]?.count || 0,
        habitsDoneToday: habitsStatus.rows[0]?.done_today || 0,
        habitsTotal: habitsStatus.rows[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Dashboard indicators error:", error);
    return apiError("Failed to fetch indicators", 500);
  }
});
