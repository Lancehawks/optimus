import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    const habit = await query(
      "SELECT id, created_at FROM habits WHERE id = $1 AND user_id = $2",
      [id, request.user.id]
    );

    if (habit.rows.length === 0) {
      return apiError("Habit not found", 404);
    }

    const createdAt = new Date(habit.rows[0].created_at);

    const logsResult = await query(
      `SELECT log_date FROM habit_logs
       WHERE habit_id = $1 AND completed = true
       ORDER BY log_date DESC`,
      [id]
    );

    const completedDates = new Set(
      logsResult.rows.map((r) => r.log_date.toISOString().split("T")[0])
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    const checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (completedDates.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    let longestStreak = 0;
    let tempStreak = 0;
    const sortedDates = Array.from(completedDates).sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }

    const daysSinceCreation = Math.max(
      1,
      Math.ceil((today - createdAt) / (1000 * 60 * 60 * 24)) + 1
    );
    const completionRate = Math.min(
      100,
      Math.round((completedDates.size / daysSinceCreation) * 100)
    );

    const monthlyResult = await query(
      `SELECT to_char(log_date, 'YYYY-MM') AS month,
              COUNT(*) FILTER (WHERE completed) AS completed
       FROM habit_logs
       WHERE habit_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY month
       ORDER BY month`,
      [id]
    );

    return apiResponse({
      currentStreak,
      longestStreak,
      completionRate,
      monthlyData: monthlyResult.rows,
    });
  } catch (error) {
    console.error("Habit stats error:", error);
    return apiError("Internal server error", 500);
  }
});
