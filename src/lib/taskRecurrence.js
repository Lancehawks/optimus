const RECURRENCE_OFFSETS = {
  daily: { days: 1 },
  weekly: { days: 7 },
  monthly: { months: 1 },
};

export function nextDueDate(dueDate, recurrenceRule) {
  if (!dueDate) return null;
  const offset = RECURRENCE_OFFSETS[recurrenceRule];
  if (!offset) return null;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  if (offset.days) date.setUTCDate(date.getUTCDate() + offset.days);
  if (offset.months) {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + offset.months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
  }
  return date.toISOString();
}

export async function createNextRecurringTask(client, sourceTask) {
  if (!sourceTask?.id || !RECURRENCE_OFFSETS[sourceTask.recurrence_rule]) return null;

  const positionScope = sourceTask.project_id
    ? `project:${sourceTask.project_id}`
    : `personal:${sourceTask.user_id}`;
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    [`task-position:${positionScope}`]
  );

  const positionResult = sourceTask.project_id
    ? await client.query(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
         FROM tasks
         WHERE project_id = $1 AND parent_task_id IS NULL`,
        [sourceTask.project_id]
      )
    : await client.query(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
         FROM tasks
         WHERE user_id = $1 AND project_id IS NULL AND parent_task_id IS NULL`,
        [sourceTask.user_id]
      );

  const result = await client.query(
    `INSERT INTO tasks
       (user_id, title, description, priority, due_date, project_id,
        recurrence_rule, recurrence_source_task_id, position, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'todo')
     ON CONFLICT (recurrence_source_task_id)
       WHERE recurrence_source_task_id IS NOT NULL
       DO NOTHING
     RETURNING *`,
    [
      sourceTask.user_id,
      sourceTask.title,
      sourceTask.description,
      sourceTask.priority,
      nextDueDate(sourceTask.due_date, sourceTask.recurrence_rule),
      sourceTask.project_id,
      sourceTask.recurrence_rule,
      sourceTask.id,
      positionResult.rows[0].next_pos,
    ]
  );

  return result.rows[0] || null;
}
