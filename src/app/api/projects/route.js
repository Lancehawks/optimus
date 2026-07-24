import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { PROJECT_STATUSES, validateProjectCreateBody } from "@/lib/projectValidation";
import { decodeCursor, finishCursorPage, readPageSize } from "@/lib/cursorPagination";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const includeArchived = searchParams.get("include_archived") === "true";
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"), ["createdAt", "id"]);
    if (cursor.error) return apiError(cursor.error);

    const conditions = ["pm.user_id = $1"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (status) {
      if (!PROJECT_STATUSES.includes(status)) {
        return apiError("Status filter is invalid");
      }
      conditions.push(`p.status = $${paramIndex++}`);
      params.push(status);
    }
    if (!includeArchived) {
      conditions.push("p.is_archived = false");
    }

    const cursorCondition = cursor.value
      ? `AND (p.created_at, p.id) < ($${paramIndex++}::timestamptz, $${paramIndex++}::uuid)`
      : "";
    if (cursor.value) params.push(cursor.value.createdAt, cursor.value.id);

    const result = await query(
      `WITH filtered_projects AS (
         SELECT p.*
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE ${conditions.join(" AND ")}
       ),
       task_rollup AS (
         SELECT t.project_id,
                COUNT(*)::int AS task_count,
                COUNT(*) FILTER (WHERE t.status = 'done')::int AS task_done_count,
                COUNT(*) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE)::int AS overdue_task_count,
                COUNT(*) FILTER (WHERE t.status != 'done' AND (
                  t.status = 'on_hold' OR EXISTS (
                    SELECT 1 FROM task_dependencies td
                    JOIN tasks dependency ON dependency.id = td.depends_on_task_id
                    WHERE td.task_id = t.id AND dependency.status != 'done'
                  )
                ))::int AS blocked_task_count,
                MIN(t.due_date) FILTER (WHERE t.status != 'done') AS next_due_date
         FROM tasks t
         JOIN filtered_projects fp ON fp.id = t.project_id
         WHERE t.parent_task_id IS NULL AND t.is_archived = FALSE
         GROUP BY t.project_id
       ),
       milestone_rollup AS (
         SELECT m.project_id, COUNT(*)::int AS milestone_count,
                COUNT(*) FILTER (WHERE m.is_completed)::int AS milestone_done_count
         FROM milestones m JOIN filtered_projects fp ON fp.id = m.project_id
         GROUP BY m.project_id
       ),
       member_rollup AS (
         SELECT members.project_id, COUNT(*)::int AS member_count
         FROM project_members members JOIN filtered_projects fp ON fp.id = members.project_id
         GROUP BY members.project_id
       )
       SELECT p.*, (p.user_id = $1) AS is_owner,
              COALESCE(members.member_count, 0) AS member_count,
              COALESCE(tasks.task_count, 0) AS task_count,
              COALESCE(tasks.task_done_count, 0) AS task_done_count,
              COALESCE(tasks.overdue_task_count, 0) AS overdue_task_count,
              COALESCE(tasks.blocked_task_count, 0) AS blocked_task_count,
              tasks.next_due_date,
              COALESCE(milestones.milestone_count, 0) AS milestone_count,
              COALESCE(milestones.milestone_done_count, 0) AS milestone_done_count,
              (SELECT COUNT(*)::int FROM filtered_projects) AS __filtered_count,
              (SELECT COUNT(*)::int FROM project_members all_pm WHERE all_pm.user_id = $1) AS __total_count
       FROM filtered_projects p
       LEFT JOIN task_rollup tasks ON tasks.project_id = p.id
       LEFT JOIN milestone_rollup milestones ON milestones.project_id = p.id
       LEFT JOIN member_rollup members ON members.project_id = p.id
       WHERE TRUE ${cursorCondition}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $${paramIndex}`,
      [...params, limit + 1]
    );

    const counts = result.rows[0] || {};
    const page = finishCursorPage(result.rows, limit, (row) => ({
      createdAt: row.created_at,
      id: row.id,
    }));
    const projects = page.items.map(({ __filtered_count, __total_count, ...project }) => project);
    return apiResponse({
      projects,
      pagination: {
        ...page.pagination,
        totalCount: counts.__total_count || 0,
        filteredCount: counts.__filtered_count || 0,
      },
    });
  } catch (error) {
    console.error("Projects list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateProjectCreateBody(body);
    if (validation.error) return apiError(validation.error);

    const { name, description, color, status, type, startDate, endDate } = validation.value;

    const project = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO projects (user_id, name, description, color, status, type, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          request.user.id,
          name,
          description,
          color,
          status,
          type,
          startDate,
          endDate,
        ]
      );

      await client.query(
        `INSERT INTO project_members (project_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [result.rows[0].id, request.user.id]
      );

      return result.rows[0];
    });

    return apiResponse({ project }, 201);
  } catch (error) {
    console.error("Project create error:", error);
    return apiError("Internal server error", 500);
  }
});
