import { query, transaction } from "@/lib/db";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";
import { recordProjectActivity } from "@/lib/collaborationActivity";
import { getProjectForMember, isProjectOwner, projectOwnerCondition, projectScopedAccessCondition } from "@/lib/projectAccess";
import {
  firstValidationError,
  optionalBoolean,
  optionalDate,
  optionalEnum,
  optionalInteger,
  optionalRequiredString,
  optionalString,
  optionalUuid,
  parseJsonObject,
  uuidArray,
} from "@/lib/apiValidation";
import { userOwnsAllTags, userOwnsOrTaskUsesAllTags } from "@/lib/tagAccess";
import { createNextRecurringTask } from "@/lib/taskRecurrence";

const TASK_STATUSES = ["todo", "in_progress", "on_hold", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_RECURRENCES = ["daily", "weekly", "monthly"];

function validateTaskUpdateBody(body) {
  const title = optionalRequiredString(body.title, "Title", { max: 255 });
  const description = optionalString(body.description, "Description", { max: 10000 });
  const status = optionalEnum(body.status, "Status", TASK_STATUSES);
  const priority = optionalEnum(body.priority, "Priority", TASK_PRIORITIES);
  const dueDate = optionalDate(body.dueDate, "Due date");
  const projectId = optionalUuid(body.projectId, "Project");
  const position = optionalInteger(body.position, "Position", { min: 0 });
  const recurrenceRule = optionalEnum(body.recurrenceRule, "Recurrence", TASK_RECURRENCES, {
    allowNull: true,
  });
  const deferred = optionalBoolean(body.deferred, "Deferred");
  const isArchived = optionalBoolean(body.isArchived, "Archived");
  const tags = uuidArray(body.tags, "Tags", { max: 100 });
  const dependencies = uuidArray(body.dependencies, "Dependencies", { max: 100 });

  const error = firstValidationError(
    title,
    description,
    status,
    priority,
    dueDate,
    projectId,
    position,
    recurrenceRule,
    deferred,
    isArchived,
    tags,
    dependencies
  );
  if (error) return { error };

  const value = {};
  if (title.provided) value.title = title.value;
  if (description.provided) value.description = description.value;
  if (status.provided) value.status = status.value;
  if (priority.provided) value.priority = priority.value;
  if (dueDate.provided) value.dueDate = dueDate.value;
  if (projectId.provided) value.projectId = projectId.value;
  if (position.provided) value.position = position.value;
  if (recurrenceRule.provided) value.recurrenceRule = recurrenceRule.value;
  if (deferred.provided) value.deferred = deferred.value;
  if (isArchived.provided) value.isArchived = isArchived.value;
  if (tags.provided) value.tags = tags.value;
  if (dependencies.provided) value.dependencies = dependencies.value;

  return { value };
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Task", { allowNull: false }).error) {
      return apiError("Task ID is invalid");
    }

    const result = await query(
      `SELECT t.*,
        ${projectOwnerCondition("t")} AS is_project_owner,
        COALESCE(
          json_agg(
            json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
          ) FILTER (WHERE tg.id IS NOT NULL),
          '[]'
        ) AS tags
       FROM tasks t
       LEFT JOIN task_tags tt ON tt.task_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2
       GROUP BY t.id`,
      [request.user.id, id]
    );

    if (result.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    // Get subtasks
    const subtasksResult = await query(
      "SELECT * FROM tasks WHERE parent_task_id = $1 ORDER BY position ASC, created_at ASC",
      [id]
    );

    // Get dependencies (tasks this task depends on)
    const depsResult = await query(
      `SELECT t.id, t.title, t.status FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE ${projectScopedAccessCondition("t")} AND td.task_id = $2`,
      [request.user.id, id]
    );

    const task = { ...result.rows[0], subtasks: subtasksResult.rows, dependencies: depsResult.rows };
    return apiResponse({ task });
  } catch (error) {
    console.error("Task get error:", error);
    return apiError("Internal server error", 500);
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Task", { allowNull: false }).error) {
      return apiError("Task ID is invalid");
    }

    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const validation = validateTaskUpdateBody(body);
    if (validation.error) return apiError(validation.error);
    const updates = validation.value;

    // Verify personal ownership or shared project membership.
    const existing = await query(
      `SELECT t.*
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );
    if (existing.rows.length === 0) {
      return apiError("Task not found", 404);
    }
    const currentTask = existing.rows[0];
    const effectiveProjectId = updates.projectId !== undefined ? updates.projectId : currentTask.project_id;
    const isMovingTask = updates.projectId !== undefined && effectiveProjectId !== currentTask.project_id;
    const isCreator = currentTask.user_id === request.user.id;
    const isCurrentProjectOwner = Boolean(
      currentTask.project_id && (await isProjectOwner(request.user.id, currentTask.project_id))
    );

    if (!isCreator && !isCurrentProjectOwner) {
      return apiError("Only the task creator or project creator can edit this task", 403);
    }

    if (isMovingTask) {
      if (effectiveProjectId) {
        const project = await getProjectForMember(request.user.id, effectiveProjectId);
        if (!project) {
          return apiError("Project not found", 404);
        }
      }
    }

    if (updates.tags !== undefined) {
      const canUseTags = isCurrentProjectOwner
        ? await userOwnsOrTaskUsesAllTags(request.user.id, updates.tags, id)
        : await userOwnsAllTags(request.user.id, updates.tags);
      if (!canUseTags) return apiError("One or more tags are not available", 403);
    }

    const normalizedDeps = updates.dependencies !== undefined
      ? updates.dependencies.filter((depId) => depId !== id)
      : undefined;

    if (normalizedDeps !== undefined && normalizedDeps.length > 0) {
      const dependencyParams = [request.user.id, normalizedDeps];
      let dependencyProjectClause = "";

      if (effectiveProjectId) {
        dependencyProjectClause = "AND t.project_id = $3";
        dependencyParams.push(effectiveProjectId);
      }

      const dependencyAccess = await query(
        `SELECT COUNT(DISTINCT t.id)::int AS count
         FROM tasks t
         WHERE ${projectScopedAccessCondition("t")}
           AND t.id = ANY($2::uuid[])
           ${dependencyProjectClause}`,
        dependencyParams
      );

      if ((dependencyAccess.rows[0]?.count || 0) !== normalizedDeps.length) {
        return apiError("One or more dependencies are not available to this task", 403);
      }
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(updates.description); }
    if (updates.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(updates.status); }
    if (updates.priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(updates.priority); }
    if (updates.dueDate !== undefined) { fields.push(`due_date = $${paramIndex++}`); values.push(updates.dueDate); }
    if (updates.projectId !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(updates.projectId); }
    if (updates.position !== undefined) { fields.push(`position = $${paramIndex++}`); values.push(updates.position); }
    if (updates.recurrenceRule !== undefined) { fields.push(`recurrence_rule = $${paramIndex++}`); values.push(updates.recurrenceRule); }
    if (updates.deferred !== undefined) { fields.push(`deferred = $${paramIndex++}`); values.push(updates.deferred); }
    if (updates.isArchived !== undefined) { fields.push(`is_archived = $${paramIndex++}`); values.push(updates.isArchived); }

    const updatedTask = await transaction(async (client) => {
      const lockedResult = await client.query(
        "SELECT * FROM tasks WHERE id = $1 FOR UPDATE",
        [id]
      );
      if (lockedResult.rows.length === 0) {
        throw Object.assign(new Error("Task not found"), { status: 404 });
      }
      const taskBeforeUpdate = lockedResult.rows[0];
      const becameDone = updates.status === "done" && taskBeforeUpdate.status !== "done";

      if (fields.length > 0) {
        values.push(id);
        await client.query(
          `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
          values
        );
      }

      // Transition checks plus a unique source key make retries and concurrent
      // completion requests create at most one next occurrence.
      if (becameDone) {
        const taskResult = await client.query("SELECT * FROM tasks WHERE id = $1", [id]);
        const taskAfterStatusUpdate = taskResult.rows[0];
        if (taskAfterStatusUpdate?.recurrence_rule) {
          await createNextRecurringTask(client, taskAfterStatusUpdate);
        }
      }

      if (normalizedDeps !== undefined) {
        await client.query("DELETE FROM task_dependencies WHERE task_id = $1", [id]);
        for (const depId of normalizedDeps) {
          await client.query(
            "INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [id, depId]
          );
        }
      }

      if (updates.tags !== undefined) {
        await client.query("DELETE FROM task_tags WHERE task_id = $1", [id]);
        for (const tagId of updates.tags) {
          await client.query(
            "INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [id, tagId]
          );
        }
      }

      const result = await client.query(
        `SELECT t.*,
          ${projectOwnerCondition("t")} AS is_project_owner,
          COALESCE(
            json_agg(
              json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)
            ) FILTER (WHERE tg.id IS NOT NULL),
            '[]'
          ) AS tags
         FROM tasks t
         LEFT JOIN task_tags tt ON tt.task_id = t.id
         LEFT JOIN tags tg ON tg.id = tt.tag_id
         WHERE ${projectScopedAccessCondition("t")} AND t.id = $2
         GROUP BY t.id`,
        [request.user.id, id]
      );

      const task = result.rows[0];
      if (isMovingTask && currentTask.project_id && !effectiveProjectId) {
        await recordProjectActivity({
          projectId: currentTask.project_id,
          actorUserId: request.user.id,
          action: "moved_to_personal",
          entityType: "task",
          entityId: currentTask.id,
          entityTitle: currentTask.title,
          db: client,
          strict: true,
        });
      } else if (effectiveProjectId) {
        await recordProjectActivity({
          projectId: effectiveProjectId,
          actorUserId: request.user.id,
          action: isMovingTask
            ? "moved_to_project"
            : updates.status === "done" && currentTask.status !== "done"
              ? "completed"
              : "updated",
          entityType: "task",
          entityId: task.id,
          entityTitle: task.title,
          db: client,
          strict: true,
        });
      }

      return task;
    });

    return apiResponse({ task: updatedTask });
  } catch (error) {
    if (error.status) return apiError(error.message, error.status);
    console.error("Task update error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    if (optionalUuid(id, "Task", { allowNull: false }).error) {
      return apiError("Task ID is invalid");
    }

    const existing = await query(
      `SELECT t.id, t.user_id, t.project_id, t.title
       FROM tasks t
       WHERE ${projectScopedAccessCondition("t")} AND t.id = $2`,
      [request.user.id, id]
    );

    if (existing.rows.length === 0) {
      return apiError("Task not found", 404);
    }

    const task = existing.rows[0];
    const isCreator = task.user_id === request.user.id;
    const isOwner = task.project_id && (await isProjectOwner(request.user.id, task.project_id));

    const canDelete = task.project_id ? Boolean(isOwner) : isCreator;
    if (!canDelete) {
      return apiError("Only the project creator can delete project tasks", 403);
    }

    await transaction(async (client) => {
      await client.query("DELETE FROM tasks WHERE id = $1", [id]);

      if (task.project_id) {
        await recordProjectActivity({
          projectId: task.project_id,
          actorUserId: request.user.id,
          action: "deleted",
          entityType: "task",
          entityId: task.id,
          entityTitle: task.title,
          db: client,
          strict: true,
        });
      }
    });

    return apiResponse({ message: "Task deleted" });
  } catch (error) {
    console.error("Task delete error:", error);
    return apiError("Internal server error", 500);
  }
});
