import { query } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const projectId = searchParams.get("project_id");
    const sort = searchParams.get("sort") || "position";
    const order = searchParams.get("order") || "asc";

    const conditions = ["t.user_id = $1", "t.parent_task_id IS NULL"];
    const params = [request.user.id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`t.priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (search) {
      conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (projectId) {
      conditions.push(`t.project_id = $${paramIndex++}`);
      params.push(projectId);
    }

    const sortColumns = {
      position: "t.position",
      due_date: "t.due_date",
      priority: "CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END",
      created_at: "t.created_at",
      title: "t.title",
    };
    const sortCol = sortColumns[sort] || "t.position";
    const sortOrder = order === "desc" ? "DESC" : "ASC";

    const result = await query(
      `SELECT t.*,
        p.name AS project_name, p.color AS project_color,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags,
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id)::int AS subtask_count,
        (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND st.status = 'done')::int AS subtask_done_count,
        (SELECT COUNT(*) FROM task_dependencies td WHERE td.task_id = t.id)::int AS dependency_count,
        (SELECT COUNT(*) FROM task_dependencies td
         JOIN tasks dt ON dt.id = td.depends_on_task_id
         WHERE td.task_id = t.id AND dt.status != 'done')::int AS blocking_count
       FROM tasks t
       LEFT JOIN task_tags tt ON tt.task_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY t.id, p.name, p.color
       ORDER BY ${sortCol} ${sortOrder} NULLS LAST, t.created_at DESC`,
      params
    );

    return apiResponse({ tasks: result.rows });
  } catch (error) {
    console.error("Tasks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const { title, description, status, priority, dueDate, projectId, tags, recurrenceRule } = body;

    if (!title) {
      return apiError("Title is required");
    }

    // Get max position
    const posResult = await query(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = $1 AND parent_task_id IS NULL",
      [request.user.id]
    );
    const position = posResult.rows[0].next_pos;

    const result = await query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date, project_id, position, recurrence_rule)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        request.user.id,
        title,
        description || null,
        status || "todo",
        priority || "medium",
        dueDate || null,
        projectId || null,
        position,
        recurrenceRule || null,
      ]
    );

    const task = result.rows[0];

    // Add tags if provided
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await query(
          "INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [task.id, tagId]
        );
      }
    }

    return apiResponse({ task }, 201);
  } catch (error) {
    console.error("Task create error:", error);
    return apiError("Internal server error", 500);
  }
});
