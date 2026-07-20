import { query } from "@/lib/db";
import { withAuth, apiError, apiResponse } from "@/lib/apiUtils";
import { projectScopedAccessCondition } from "@/lib/projectAccess";
import { listEventsForRange } from "@/lib/events/eventCollectionService";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const today = searchParams.get("today");
    const weekStart = searchParams.get("week_start");
    const weekEnd = searchParams.get("week_end");
    const upcomingEnd = searchParams.get("upcoming_end");
    const rangeStart = searchParams.get("range_start");
    const rangeEnd = searchParams.get("range_end");
    const timeZone = searchParams.get("time_zone") || "UTC";
    const dates = [today, weekStart, weekEnd, upcomingEnd];

    if (dates.some((value) => !DATE_PATTERN.test(value || "")) || !rangeStart || !rangeEnd) {
      return apiError("Dashboard date range is invalid");
    }
    if (!validTimeZone(timeZone)) return apiError("Time zone is invalid");

    const previousWeekStart = new Date(`${weekStart}T00:00:00Z`);
    previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
    const previousWeekStartKey = previousWeekStart.toISOString().slice(0, 10);

    const [overviewResult, eventResult, dayPlanResult] = await Promise.all([
      query(
        `WITH blocking_rollup AS (
           SELECT td.task_id,
                  COUNT(*) FILTER (WHERE dependency.status != 'done')::int AS blocking_count
           FROM task_dependencies td
           JOIN tasks dependency ON dependency.id = td.depends_on_task_id
           GROUP BY td.task_id
         ),
         accessible_tasks AS (
           SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id,
                  t.updated_at, p.name AS project_name,
                  COALESCE(blocking.blocking_count, 0) AS blocking_count
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN blocking_rollup blocking ON blocking.task_id = t.id
           WHERE ${projectScopedAccessCondition("t")}
             AND t.parent_task_id IS NULL AND t.is_archived = FALSE
         ),
         accessible_projects AS (
           SELECT p.id, p.name, p.color, p.status, p.end_date
           FROM projects p
           JOIN project_members pm ON pm.project_id = p.id
           WHERE pm.user_id = $1 AND p.is_archived = FALSE
         ),
         project_task_rollup AS (
           SELECT project.id,
                  COUNT(task.id)::int AS task_count,
                  COUNT(task.id) FILTER (WHERE task.status = 'done')::int AS task_done_count,
                  COUNT(task.id) FILTER (WHERE task.status != 'done' AND (task.due_date AT TIME ZONE $7)::date < $2::date)::int AS overdue_task_count,
                  COUNT(task.id) FILTER (WHERE task.status != 'done' AND (task.status = 'on_hold' OR task.blocking_count > 0))::int AS blocked_task_count,
                  MIN(task.due_date) FILTER (WHERE task.status != 'done') AS next_due_date
           FROM accessible_projects project
           LEFT JOIN accessible_tasks task ON task.project_id = project.id
           GROUP BY project.id
         ),
         metrics AS (
           SELECT
             COUNT(*) FILTER (WHERE task.status != 'done')::int AS open_tasks,
             COUNT(*) FILTER (WHERE task.status != 'done' AND (task.due_date AT TIME ZONE $7)::date = $2::date)::int AS due_today,
             COUNT(*) FILTER (WHERE task.status != 'done' AND (
               (task.due_date IS NOT NULL AND (task.due_date AT TIME ZONE $7)::date < $2::date)
               OR task.status = 'on_hold' OR task.priority IN ('urgent', 'high') OR task.blocking_count > 0
             ))::int AS attention_count,
             COUNT(*) FILTER (WHERE task.status = 'done' AND (task.updated_at AT TIME ZONE $7)::date >= $3::date AND (task.updated_at AT TIME ZONE $7)::date < $4::date)::int AS completed_this_week,
             COUNT(*) FILTER (WHERE task.status = 'done' AND (task.updated_at AT TIME ZONE $7)::date >= $6::date AND (task.updated_at AT TIME ZONE $7)::date < $3::date)::int AS completed_last_week
           FROM accessible_tasks task
         )
         SELECT
           jsonb_build_object(
             'openTasks', metrics.open_tasks,
             'dueToday', metrics.due_today,
             'attentionCount', metrics.attention_count,
             'tasksCompletedThisWeek', metrics.completed_this_week,
             'tasksCompletedLastWeek', metrics.completed_last_week,
             'activeProjects', (SELECT COUNT(*)::int FROM accessible_projects WHERE status = 'active'),
             'totalProjects', (SELECT COUNT(*)::int FROM accessible_projects)
           ) AS metrics,
           COALESCE((
             SELECT jsonb_agg(to_jsonb(attention)) FROM (
               SELECT task.id, task.title, task.status, task.priority, task.due_date,
                      task.project_name, task.blocking_count
               FROM accessible_tasks task
               WHERE task.status != 'done' AND (
                 (task.due_date IS NOT NULL AND (task.due_date AT TIME ZONE $7)::date < $2::date)
                 OR task.status = 'on_hold' OR task.priority IN ('urgent', 'high') OR task.blocking_count > 0
               )
               ORDER BY
                 CASE
                   WHEN task.due_date IS NOT NULL AND (task.due_date AT TIME ZONE $7)::date < $2::date THEN 0
                   WHEN task.blocking_count > 0 THEN 1 WHEN task.status = 'on_hold' THEN 2
                   WHEN task.priority = 'urgent' THEN 3 ELSE 4
                 END,
                 task.due_date NULLS LAST, task.id
               LIMIT 8
             ) attention
           ), '[]'::jsonb) AS attention_tasks,
           COALESCE((
             SELECT jsonb_agg(to_jsonb(health)) FROM (
               SELECT project.*, rollup.task_count, rollup.task_done_count,
                      rollup.overdue_task_count, rollup.blocked_task_count, rollup.next_due_date
               FROM accessible_projects project
               JOIN project_task_rollup rollup ON rollup.id = project.id
               WHERE project.status = 'active'
               ORDER BY
                 CASE WHEN rollup.blocked_task_count > 0 OR rollup.overdue_task_count > 0 THEN 0
                      WHEN rollup.task_count > 0 AND rollup.task_done_count < rollup.task_count THEN 1
                      WHEN rollup.task_count = 0 THEN 2 ELSE 3 END,
                 rollup.next_due_date NULLS LAST, project.id
               LIMIT 8
             ) health
           ), '[]'::jsonb) AS projects,
           COALESCE((
             SELECT jsonb_agg(to_jsonb(day_count)) FROM (
               SELECT (task.due_date AT TIME ZONE $7)::date AS due_date,
                      COUNT(*) FILTER (WHERE task.status != 'done')::int AS open,
                      COUNT(*) FILTER (WHERE task.status = 'done')::int AS done
               FROM accessible_tasks task
               WHERE (task.due_date AT TIME ZONE $7)::date >= $3::date
                 AND (task.due_date AT TIME ZONE $7)::date < $4::date
               GROUP BY (task.due_date AT TIME ZONE $7)::date
               ORDER BY due_date
             ) day_count
           ), '[]'::jsonb) AS weekly_tasks,
           COALESCE((
             SELECT jsonb_agg(to_jsonb(upcoming)) FROM (
               SELECT task.id, task.title, task.priority, task.due_date, task.project_name
               FROM accessible_tasks task
               WHERE task.status != 'done'
                 AND (task.due_date AT TIME ZONE $7)::date >= $2::date
                 AND (task.due_date AT TIME ZONE $7)::date < $5::date
               ORDER BY task.due_date, task.id LIMIT 12
             ) upcoming
           ), '[]'::jsonb) AS upcoming_tasks
         FROM metrics`,
        [
          request.user.id,
          today,
          weekStart,
          weekEnd,
          upcomingEnd,
          previousWeekStartKey,
          timeZone,
        ]
      ),
      listEventsForRange({ userId: request.user.id, start: rangeStart, end: rangeEnd }),
      query(
        `SELECT id, title, start_time, end_time
         FROM day_plan_blocks WHERE user_id = $1 ORDER BY position, start_time LIMIT 20`,
        [request.user.id]
      ),
    ]);

    const overview = overviewResult.rows[0] || {};
    const events = (eventResult.events || []).map((event) => ({
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      all_day: event.all_day,
      project_name: event.project_name,
    }));

    return apiResponse({
      overview: {
        metrics: overview.metrics || {},
        attentionTasks: overview.attention_tasks || [],
        projects: overview.projects || [],
        weeklyTasks: overview.weekly_tasks || [],
        upcomingTasks: overview.upcoming_tasks || [],
        events,
        dayPlanBlocks: dayPlanResult.rows,
      },
    });
  } catch (error) {
    if (error?.status && error.status < 500) return apiError(error.message, error.status);
    console.error("Dashboard overview error:", error);
    return apiError("Failed to load dashboard overview", 500);
  }
});
