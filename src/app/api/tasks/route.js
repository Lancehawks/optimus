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

    if (status && !TASK_STATUSES.includes(status)) {
      return apiError("Status filter is invalid");
    }
    if (priority && !TASK_PRIORITIES.includes(priority)) {
      return apiError("Priority filter is invalid");
    }
    if (projectId && optionalUuid(projectId, "Project", { allowNull: false }).error) {
      return apiError("Project filter is invalid");
    }

    const conditions = [projectScopedAccessCondition("t"), "t.parent_task_id IS NULL"];
    if (!includeArchived) conditions.push("t.is_archived = false");
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
        ${projectOwnerCondition("t")} AS is_project_owner,
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
