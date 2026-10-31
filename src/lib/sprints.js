import {
  firstValidationError,
  optionalRequiredString,
  optionalString,
  requiredString,
} from "./apiValidation.js";
import { creatorOrProjectOwnerCondition, projectScopedAccessCondition } from "./projectAccessSql.js";

// Sprints belong to one member and span all their work. Every query is scoped
// with $1 = the member's id, so another member's sprint behaves as if it didn't
// exist. Functions take a db handle (the pool's query wrapper or a transaction
// client) and return { error, status } for anything the caller should report.

const UNIQUE_VIOLATION = "23505";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function validateDate(value, label) {
  if (value === undefined) return { provided: false };
  if (!isCalendarDate(value)) return { error: `${label} must be a valid date` };
  return { provided: true, value };
}

export function validateSprintCreate(body) {
  const name = requiredString(body.name, "Name");
  const goal = optionalString(body.goal, "Goal", { max: 2000 });
  const startDate = validateDate(body.startDate, "Start date");
  const endDate = validateDate(body.endDate, "End date");
  const error = firstValidationError(name, goal, startDate, endDate);
  if (error) return { error };
  if (!startDate.provided) return { error: "Start date is required" };
  if (!endDate.provided) return { error: "End date is required" };
  if (endDate.value < startDate.value) return { error: "End date can't be before the start date" };

  return {
    value: {
      name: name.value,
      goal: goal.provided ? goal.value : null,
      startDate: startDate.value,
      endDate: endDate.value,
    },
  };
}

export function validateSprintUpdate(body) {
  const name = optionalRequiredString(body.name, "Name");
  const goal = optionalString(body.goal, "Goal", { max: 2000 });
  const startDate = validateDate(body.startDate, "Start date");
  const endDate = validateDate(body.endDate, "End date");
  const error = firstValidationError(name, goal, startDate, endDate);
  if (error) return { error };

  return {
    value: {
      ...(name.provided ? { name: name.value } : {}),
      ...(goal.provided ? { goal: goal.value } : {}),
      ...(startDate.provided ? { startDate: startDate.value } : {}),
      ...(endDate.provided ? { endDate: endDate.value } : {}),
    },
  };
}

// Open sprints count what the board shows: tasks the member can still see,
// without unfinished archived ones. A closed sprint counts its recorded
// outcomes, so reopening or losing access to a task later doesn't rewrite it.
const SPRINT_WITH_COUNTS = `
  SELECT s.*,
         COUNT(t.id)::int AS task_count,
         COUNT(t.id) FILTER (
           WHERE CASE WHEN s.status = 'completed' THEN st.outcome = 'completed' ELSE t.status = 'done' END
         )::int AS done_count,
         COUNT(t.id) FILTER (WHERE st.added_at > s.started_at)::int AS added_count
  FROM sprints s
  LEFT JOIN sprint_tasks st ON st.sprint_id = s.id
  LEFT JOIN tasks t ON t.id = st.task_id AND (
    s.status = 'completed'
    OR (${projectScopedAccessCondition("t")} AND (t.is_archived = FALSE OR t.status = 'done'))
  )
  WHERE s.user_id = $1`;

export async function listSprints(db, userId) {
  const result = await db.query(
    `${SPRINT_WITH_COUNTS}
     GROUP BY s.id
     ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END,
              CASE WHEN s.status = 'planned' THEN s.start_date END ASC,
              s.completed_at DESC NULLS LAST,
              s.created_at DESC
     LIMIT 200`,
    [userId]
  );
  return result.rows;
}

export async function getSprint(db, userId, sprintId) {
  const result = await db.query(
    `${SPRINT_WITH_COUNTS} AND s.id = $2 GROUP BY s.id`,
    [userId, sprintId]
  );
  return result.rows[0] || null;
}

// The record of a sprint, including what happened to each task it held.
export async function getSprintDetail(db, userId, sprintId) {
  const sprint = await getSprint(db, userId, sprintId);
  if (!sprint) return null;

  const tasks = await db.query(
    `SELECT t.id, t.title, t.status, t.priority, t.project_id,
            p.name AS project_name, p.color AS project_color, p.logo_file_id AS project_logo_file_id,
            st.outcome, st.added_at
     FROM sprint_tasks st
     JOIN tasks t ON t.id = st.task_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE st.user_id = $1 AND st.sprint_id = $2 AND ${projectScopedAccessCondition("t")}
     ORDER BY st.outcome ASC NULLS LAST, st.added_at ASC, t.id ASC`,
    [userId, sprintId]
  );
  return { ...sprint, tasks: tasks.rows };
}

export async function createSprint(db, userId, { name, goal, startDate, endDate }) {
  const result = await db.query(
    `INSERT INTO sprints (user_id, name, goal, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, name, goal, startDate, endDate]
  );
  return getSprint(db, userId, result.rows[0].id);
}

export async function updateSprint(db, userId, sprintId, updates) {
  const existing = await db.query(
    "SELECT start_date, end_date FROM sprints WHERE user_id = $1 AND id = $2",
    [userId, sprintId]
  );
  if (existing.rows.length === 0) return { error: "Sprint not found", status: 404 };

  const startDate = updates.startDate ?? existing.rows[0].start_date;
  const endDate = updates.endDate ?? existing.rows[0].end_date;
  if (endDate < startDate) return { error: "End date can't be before the start date", status: 400 };

  await db.query(
    `UPDATE sprints
     SET name = COALESCE($3, name),
         goal = CASE WHEN $4::boolean THEN $5 ELSE goal END,
         start_date = $6,
         end_date = $7
     WHERE user_id = $1 AND id = $2`,
    [
      userId,
      sprintId,
      updates.name ?? null,
      updates.goal !== undefined,
      updates.goal ?? null,
      startDate,
      endDate,
    ]
  );
  return { sprint: await getSprint(db, userId, sprintId) };
}

// Removes the sprint and its record. The tasks themselves are untouched.
export async function deleteSprint(db, userId, sprintId) {
  const result = await db.query(
    "DELETE FROM sprints WHERE user_id = $1 AND id = $2 RETURNING id",
    [userId, sprintId]
  );
  return result.rows.length > 0;
}

export async function startSprint(db, userId, sprintId) {
  try {
    const result = await db.query(
      `UPDATE sprints
       SET status = 'active', started_at = NOW()
       WHERE user_id = $1 AND id = $2 AND status = 'planned'
       RETURNING id`,
      [userId, sprintId]
    );
    if (result.rows.length > 0) return { sprint: await getSprint(db, userId, sprintId) };
  } catch (error) {
    if (error.code !== UNIQUE_VIOLATION) throw error;
    return { error: "Close your active sprint before starting another", status: 409 };
  }

  const existing = await db.query("SELECT id FROM sprints WHERE user_id = $1 AND id = $2", [userId, sprintId]);
  return existing.rows.length > 0
    ? { error: "Only a planned sprint can be started", status: 409 }
    : { error: "Sprint not found", status: 404 };
}

async function lockSprint(client, userId, sprintId) {
  const result = await client.query(
    "SELECT id, status FROM sprints WHERE user_id = $1 AND id = $2 FOR UPDATE",
    [userId, sprintId]
  );
  return result.rows[0] || null;
}

// Moves tasks here from any other open sprint. Call inside a transaction.
export async function addTasksToSprint(client, userId, sprintId, taskIds) {
  const sprint = await lockSprint(client, userId, sprintId);
  if (!sprint) return { error: "Sprint not found", status: 404 };
  if (sprint.status === "completed") return { error: "This sprint is closed", status: 409 };

  const eligible = await client.query(
    `SELECT t.id FROM tasks t
     WHERE t.id = ANY($2::uuid[])
       AND ${projectScopedAccessCondition("t")}
       AND ${creatorOrProjectOwnerCondition("t")}
       AND t.parent_task_id IS NULL
       AND t.is_archived = FALSE
       AND t.status <> 'done'`,
    [userId, taskIds]
  );
  if (eligible.rows.length !== taskIds.length) {
    return { error: "Only open tasks you can edit can join a sprint", status: 400 };
  }

  await client.query(
    `DELETE FROM sprint_tasks
     WHERE user_id = $1 AND task_id = ANY($2::uuid[]) AND outcome IS NULL AND sprint_id <> $3`,
    [userId, taskIds, sprintId]
  );
  await client.query(
    `INSERT INTO sprint_tasks (sprint_id, user_id, task_id)
     SELECT $1::uuid, $2::uuid, task_id FROM unnest($3::uuid[]) AS task_id
     ON CONFLICT DO NOTHING`,
    [sprintId, userId, taskIds]
  );
  return { sprint: await getSprint(client, userId, sprintId) };
}

export async function removeTasksFromSprint(client, userId, sprintId, taskIds) {
  const sprint = await lockSprint(client, userId, sprintId);
  if (!sprint) return { error: "Sprint not found", status: 404 };
  if (sprint.status === "completed") return { error: "This sprint is closed", status: 409 };

  await client.query(
    "DELETE FROM sprint_tasks WHERE user_id = $1 AND sprint_id = $2 AND task_id = ANY($3::uuid[])",
    [userId, sprintId, taskIds]
  );
  return { sprint: await getSprint(client, userId, sprintId) };
}

// Records each task's outcome and moves unfinished work to a planned sprint,
// or to the backlog when there's none. Call inside a transaction.
export async function completeSprint(client, userId, sprintId, { carryOverSprintId = null } = {}) {
  const sprint = await lockSprint(client, userId, sprintId);
  if (!sprint) return { error: "Sprint not found", status: 404 };
  if (sprint.status !== "active") return { error: "Only the active sprint can be closed", status: 409 };

  if (carryOverSprintId) {
    const target = await lockSprint(client, userId, carryOverSprintId);
    if (!target || target.status !== "planned") {
      return { error: "Unfinished tasks can only move to a planned sprint", status: 400 };
    }
  }

  // Tasks the board no longer shows don't belong in the record: ones the member
  // lost access to, and unfinished ones that were archived.
  await client.query(
    `DELETE FROM sprint_tasks st
     USING tasks t
     WHERE st.task_id = t.id
       AND st.user_id = $1
       AND st.sprint_id = $2
       AND NOT (${projectScopedAccessCondition("t")} AND (t.is_archived = FALSE OR t.status = 'done'))`,
    [userId, sprintId]
  );
  await client.query(
    `UPDATE sprint_tasks st
     SET outcome = CASE WHEN t.status = 'done' THEN 'completed' ELSE 'unfinished' END
     FROM tasks t
     WHERE st.task_id = t.id AND st.user_id = $1 AND st.sprint_id = $2`,
    [userId, sprintId]
  );
  if (carryOverSprintId) {
    await client.query(
      `INSERT INTO sprint_tasks (sprint_id, user_id, task_id)
       SELECT $3::uuid, user_id, task_id FROM sprint_tasks
       WHERE user_id = $1 AND sprint_id = $2 AND outcome = 'unfinished'
       ON CONFLICT DO NOTHING`,
      [userId, sprintId, carryOverSprintId]
    );
  }
  await client.query(
    "UPDATE sprints SET status = 'completed', completed_at = NOW() WHERE user_id = $1 AND id = $2",
    [userId, sprintId]
  );
  return { sprint: await getSprint(client, userId, sprintId) };
}
