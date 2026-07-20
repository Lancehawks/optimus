import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember, projectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";
import {
  firstValidationError,
  optionalDate,
  optionalEnum,
  optionalString,
  optionalUuid,
  parseJsonObject,
  requiredString,
  uuidArray,
} from "@/lib/apiValidation";
import { userOwnsAllTags } from "@/lib/tagAccess";
import { decodeCursor, finishCursorPage, readPageSize } from "@/lib/cursorPagination";

const TASK_STATUSES = ["todo", "in_progress", "on_hold", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_RECURRENCES = ["daily", "weekly", "monthly"];

function validateTaskCreateBody(body) {
  const title = requiredString(body.title, "Title", { max: 255 });
  const description = optionalString(body.description, "Description", { max: 10000 });
  const status = optionalEnum(body.status, "Status", TASK_STATUSES);
  const priority = optionalEnum(body.priority, "Priority", TASK_PRIORITIES);
  const dueDate = optionalDate(body.dueDate, "Due date");
  const projectId = optionalUuid(body.projectId, "Project");
  const tags = uuidArray(body.tags, "Tags", { max: 100 });
  const recurrenceRule = optionalEnum(body.recurrenceRule, "Recurrence", TASK_RECURRENCES, {
    allowNull: true,
  });

  const error = firstValidationError(
    title,
    description,
    status,
    priority,
    dueDate,
    projectId,
    tags,
    recurrenceRule
  );
  if (error) return { error };

  return {
    value: {
      title: title.value,
      description: description.provided ? description.value : null,
      status: status.provided ? status.value : "todo",
      priority: priority.provided ? priority.value : "medium",
      dueDate: dueDate.provided ? dueDate.value : null,
      projectId: projectId.provided ? projectId.value : null,
      tags: tags.provided ? tags.value : [],
      recurrenceRule: recurrenceRule.provided ? recurrenceRule.value : null,
    },
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const projectId = searchParams.get("project_id");
    const includeArchived = searchParams.get("include_archived") === "true";
    const sort = searchParams.get("sort") || "position";
    const order = searchParams.get("order") || "asc";
    const dashboardMode = searchParams.get("dashboard") === "true";
    const dashboardFrom = searchParams.get("from");
    const dashboardTo = searchParams.get("to");
    const limit = readPageSize(searchParams, { fallback: 50, maximum: 100 });
    const cursor = decodeCursor(searchParams.get("cursor"), [
      "sort", "order", "valueIsNull", "createdAt", "id",
    ]);
    if (cursor.error) return apiError(cursor.error);

    if (status && !TASK_STATUSES.includes(status)) {
      return apiError("Status filter is invalid");
    }
    if (priority && !TASK_PRIORITIES.includes(priority)) {
      return apiError("Priority filter is invalid");
    }
    if (projectId && optionalUuid(projectId, "Project", { allowNull: false }).error) {
      return apiError("Project filter is invalid");
    }
    if (search && search.length > 200) return apiError("Search must be 200 characters or less");
    if (dashboardMode && (!/^\d{4}-\d{2}-\d{2}$/.test(dashboardFrom || "") || !/^\d{4}-\d{2}-\d{2}$/.test(dashboardTo || ""))) {
      return apiError("Dashboard date range is invalid");
    }

    const conditions = [projectScopedAccessCondition("t"), "t.parent_task_id IS NULL"];
    if (!includeArchived) conditions.push("t.is_archived = false");
    const scopeConditions = [...conditions];
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
    if (dashboardMode) {
      conditions.push(`(
        (t.due_date >= $${paramIndex}::date AND t.due_date < $${paramIndex + 1}::date)
        OR (t.status != 'done' AND (
          t.due_date < $${paramIndex}::date OR t.status = 'on_hold' OR t.priority IN ('urgent', 'high')
        ))
      )`);
      params.push(dashboardFrom, dashboardTo);
      paramIndex += 2;
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

    if (cursor.value && (cursor.value.sort !== sort || cursor.value.order !== sortOrder.toLowerCase())) {
      return apiError("Pagination cursor does not match the requested sort");
    }

    let cursorCondition = "";
    if (cursor.value) {
      const tieCreatedParam = cursor.value.valueIsNull ? paramIndex : paramIndex + 1;
      const tieIdParam = tieCreatedParam + 1;
      if (cursor.value.valueIsNull) {
        cursorCondition = `WHERE page_source.__sort_value IS NULL
          AND (page_source.created_at, page_source.id) < ($${tieCreatedParam}::timestamptz, $${tieIdParam}::uuid)`;
        params.push(cursor.value.createdAt, cursor.value.id);
        paramIndex += 2;
      } else {
        const comparison = sortOrder === "DESC" ? "<" : ">";
        cursorCondition = `WHERE (
          page_source.__sort_value ${comparison} $${paramIndex}
          OR (page_source.__sort_value = $${paramIndex}
            AND (page_source.created_at, page_source.id) < ($${tieCreatedParam}::timestamptz, $${tieIdParam}::uuid))
          OR page_source.__sort_value IS NULL
        )`;
        params.push(cursor.value.value, cursor.value.createdAt, cursor.value.id);
        paramIndex += 3;
      }
    }

    const result = await query(
      `WITH filtered_tasks AS (
         SELECT t.*, p.name AS project_name, p.color AS project_color,
                ${projectOwnerCondition("t")} AS is_project_owner,
                ${sortCol} AS __sort_value
         FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
         WHERE ${conditions.join(" AND ")}
       ),
       page AS (
         SELECT page_source.*,
                (SELECT COUNT(*)::int FROM filtered_tasks) AS __filtered_count,
                (SELECT COUNT(*)::int FROM tasks t WHERE ${scopeConditions.join(" AND ")}) AS __total_count
         FROM filtered_tasks page_source
         ${cursorCondition}
         ORDER BY page_source.__sort_value ${sortOrder} NULLS LAST,
                  page_source.created_at DESC, page_source.id DESC
         LIMIT $${paramIndex}
       ),
       tag_rollup AS (
         SELECT tt.task_id,
                json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)) AS tags
         FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id
         JOIN page ON page.id = tt.task_id GROUP BY tt.task_id
       ),
       subtask_rollup AS (
         SELECT st.parent_task_id AS task_id, COUNT(*)::int AS subtask_count,
                COUNT(*) FILTER (WHERE st.status = 'done')::int AS subtask_done_count
         FROM tasks st JOIN page ON page.id = st.parent_task_id GROUP BY st.parent_task_id
       ),
       dependency_rollup AS (
         SELECT td.task_id, COUNT(*)::int AS dependency_count,
                COUNT(*) FILTER (WHERE dependency.status != 'done')::int AS blocking_count
         FROM task_dependencies td
         JOIN tasks dependency ON dependency.id = td.depends_on_task_id
         JOIN page ON page.id = td.task_id GROUP BY td.task_id
       )
       SELECT page.*,
              COALESCE(tags.tags, '[]') AS tags,
              COALESCE(subtasks.subtask_count, 0) AS subtask_count,
              COALESCE(subtasks.subtask_done_count, 0) AS subtask_done_count,
              COALESCE(dependencies.dependency_count, 0) AS dependency_count,
              COALESCE(dependencies.blocking_count, 0) AS blocking_count
       FROM page
       LEFT JOIN tag_rollup tags ON tags.task_id = page.id
       LEFT JOIN subtask_rollup subtasks ON subtasks.task_id = page.id
       LEFT JOIN dependency_rollup dependencies ON dependencies.task_id = page.id
       ORDER BY page.__sort_value ${sortOrder} NULLS LAST, page.created_at DESC, page.id DESC`,
      [...params, limit + 1]
    );

    const counts = result.rows[0] || {};
    const page = finishCursorPage(result.rows, limit, (row) => ({
      sort,
      order: sortOrder.toLowerCase(),
      valueIsNull: row.__sort_value == null,
      value: row.__sort_value,
      createdAt: row.created_at,
      id: row.id,
    }));
    const tasks = page.items.map(({ __sort_value, __filtered_count, __total_count, ...task }) => task);
    return apiResponse({ tasks, pagination: { ...page.pagination, totalCount: counts.__total_count || 0, filteredCount: counts.__filtered_count || 0 } });
  } catch (error) {
    console.error("Tasks list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateTaskCreateBody(body);
    if (validation.error) return apiError(validation.error);

    const { title, description, status, priority, dueDate, projectId, tags, recurrenceRule } =
      validation.value;
    const targetProjectId = projectId || null;

    if (targetProjectId) {
      const project = await getProjectForMember(request.user.id, targetProjectId);
      if (!project) {
        return apiError("Project not found", 404);
      }
    }
    if (!(await userOwnsAllTags(request.user.id, tags))) {
      return apiError("One or more tags are not available", 403);
    }

    const task = await transaction(async (client) => {
      // Get max position inside the transaction so the task and tag links move together.
      const posResult = targetProjectId
        ? await client.query(
            "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE project_id = $1 AND parent_task_id IS NULL",
            [targetProjectId]
          )
        : await client.query(
            "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = $1 AND project_id IS NULL AND parent_task_id IS NULL",
            [request.user.id]
          );
      const position = posResult.rows[0].next_pos;

      const result = await client.query(
        `INSERT INTO tasks (user_id, title, description, status, priority, due_date, project_id, position, recurrence_rule)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          request.user.id,
          title,
          description,
          status,
          priority,
          dueDate,
          targetProjectId,
          position,
          recurrenceRule,
        ]
      );

      const createdTask = result.rows[0];

      for (const tagId of tags) {
        await client.query(
          "INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [createdTask.id, tagId]
        );
      }

      if (targetProjectId) {
        await recordProjectActivity({
          projectId: targetProjectId,
          actorUserId: request.user.id,
          action: "created",
          entityType: "task",
          entityId: createdTask.id,
          entityTitle: createdTask.title,
          db: client,
          strict: true,
        });
      }

      return createdTask;
    });

    return apiResponse({ task }, 201);
  } catch (error) {
    console.error("Task create error:", error);
    return apiError("Internal server error", 500);
  }
});
