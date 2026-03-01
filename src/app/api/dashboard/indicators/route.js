import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const userId = request.user.id;

    const [overdueTasks, habitsStatus] = await Promise.all([
      // Overdue tasks count
      query(
        `SELECT COUNT(*)::int AS count FROM tasks
         WHERE user_id = $1
           AND status != 'done'
           AND is_archived = false
           AND parent_task_id IS NULL
           AND due_date IS NOT NULL
           AND due_date::date < CURRENT_DATE`,
        [userId]
      ),

      // Habits done today vs total active
      query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE EXISTS(
             SELECT 1 FROM habit_logs hl
             WHERE hl.habit_id = h.id AND hl.log_date = CURRENT_DATE AND hl.completed = true
           ))::int AS done_today
         FROM habits h
         WHERE h.user_id = $1 AND h.is_active = true`,
        [userId]
      ),
    ]);

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
