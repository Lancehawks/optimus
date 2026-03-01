import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const userId = request.user.id;

    const [
      tasksThisWeek,
      tasksLastWeek,
      habitsThisWeek,
      habitsLastWeek,
      notesThisWeek,
      notesLastWeek,
    ] = await Promise.all([
      // Tasks completed this week (ISO week: Mon–Sun)
      query(
        `SELECT COUNT(*)::int AS count FROM tasks
         WHERE user_id = $1 AND status = 'done' AND parent_task_id IS NULL
           AND updated_at >= date_trunc('week', CURRENT_DATE)
           AND updated_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'`,
        [userId]
      ),

      // Tasks completed last week
      query(
        `SELECT COUNT(*)::int AS count FROM tasks
         WHERE user_id = $1 AND status = 'done' AND parent_task_id IS NULL
           AND updated_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
           AND updated_at < date_trunc('week', CURRENT_DATE)`,
        [userId]
      ),

      // Habit completions this week
      query(
        `SELECT
           (SELECT COUNT(*) FROM habit_logs hl
            JOIN habits h ON h.id = hl.habit_id
            WHERE h.user_id = $1 AND hl.completed = true
              AND hl.log_date >= date_trunc('week', CURRENT_DATE)::date
              AND hl.log_date <= CURRENT_DATE)::int AS done,
           (SELECT COUNT(*) FROM habits WHERE user_id = $1 AND is_active = true)::int
             * GREATEST(EXTRACT(ISODOW FROM CURRENT_DATE)::int, 1) AS possible`,
        [userId]
      ),

      // Habit completions last week
      query(
        `SELECT
           (SELECT COUNT(*) FROM habit_logs hl
            JOIN habits h ON h.id = hl.habit_id
            WHERE h.user_id = $1 AND hl.completed = true
              AND hl.log_date >= (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date
              AND hl.log_date < date_trunc('week', CURRENT_DATE)::date)::int AS done,
           (SELECT COUNT(*) FROM habits WHERE user_id = $1 AND is_active = true)::int * 7 AS possible`,
        [userId]
      ),

      // Notes created this week
      query(
        `SELECT COUNT(*)::int AS count FROM notes
         WHERE user_id = $1
           AND created_at >= date_trunc('week', CURRENT_DATE)`,
        [userId]
      ),

      // Notes created last week
      query(
        `SELECT COUNT(*)::int AS count FROM notes
         WHERE user_id = $1
           AND created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
           AND created_at < date_trunc('week', CURRENT_DATE)`,
        [userId]
      ),
    ]);

    const habitDoneThisWeek = habitsThisWeek.rows[0]?.done || 0;
    const habitPossibleThisWeek = habitsThisWeek.rows[0]?.possible || 0;
    const habitDoneLastWeek = habitsLastWeek.rows[0]?.done || 0;
    const habitPossibleLastWeek = habitsLastWeek.rows[0]?.possible || 0;

    return apiResponse({
      stats: {
        tasksCompletedThisWeek: tasksThisWeek.rows[0]?.count || 0,
        tasksCompletedLastWeek: tasksLastWeek.rows[0]?.count || 0,
        habitRateThisWeek:
          habitPossibleThisWeek > 0
            ? Math.round((habitDoneThisWeek / habitPossibleThisWeek) * 100)
            : 0,
        habitRateLastWeek:
          habitPossibleLastWeek > 0
            ? Math.round((habitDoneLastWeek / habitPossibleLastWeek) * 100)
            : 0,
        notesThisWeek: notesThisWeek.rows[0]?.count || 0,
        notesLastWeek: notesLastWeek.rows[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return apiError("Failed to fetch dashboard stats", 500);
  }
});
