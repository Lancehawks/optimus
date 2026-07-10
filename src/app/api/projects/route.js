import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { PROJECT_STATUSES, validateProjectCreateBody } from "@/lib/projectValidation";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const includeArchived = searchParams.get("include_archived") === "true";

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

    const result = await query(
      `SELECT p.*,
        (p.user_id = $1) AS is_owner,
        (SELECT COUNT(*) FROM project_members pm_count WHERE pm_count.project_id = p.id)::int AS member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id)::int AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')::int AS task_done_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id)::int AS milestone_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.is_completed = true)::int AS milestone_done_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.created_at DESC`,
      params
    );

    return apiResponse({ projects: result.rows });
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
