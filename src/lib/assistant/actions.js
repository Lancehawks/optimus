import { addDateDays, datetimeInput, dateKey, zonedInputToDate } from "../calendarTime.js";
import { normalizeDayPlanBlocks, saveDayPlan } from "../dayPlan.js";
import { isReservedEventColor } from "../eventServerUtils.js";
import { snapshotNoteBeforeChange } from "../noteContent.js";
import { creatorOrProjectOwnerCondition, projectScopedAccessCondition } from "../projectAccessSql.js";
import { expandRecurrences, getMasterEventId, isRecurrenceInstanceId } from "../recurrence.js";
import { addTasksToSprint } from "../sprints.js";
import { createNextRecurringTask } from "../taskRecurrence.js";
import { addMemory, listMemories, MEMORY_ITEM_MAX_LENGTH, MEMORY_ITEMS_MAX } from "./memory.js";
import { textToNote, withoutTrailingBlanks } from "./noteText.js";
import { compact, formatDay, noteHref, taskHref } from "./present.js";
import { ToolInputError, dateField, uuidField, validateToolInput } from "./schema.js";

// The changes the assistant can make. The model only ever proposes one:
//   prepare(ctx, input) checks it can be done and returns the card the member
//     sees, built from what the database says rather than what the model says.
//   apply(ctx, input) runs when the member presses Confirm, with their
//     permissions checked again, since they may have changed in the meantime.
//
// The gate is here because the assistant also reads text other people wrote.
// A line in a teammate's task must not be able to change anything, or copy
// private notes into a shared project, without the member seeing it first.
//
//   ctx = { db, userId, timeZone, today, conversationId, listEvents } to propose;
//         { db, userId, timeZone, createEvent, updateEvent, syncDayPlan,
//           recordActivity, onError } to apply.
// `@/` modules are passed in rather than imported, so tests can load this file.

const NOTE_TEXT_MAX = 20_000;
const NOTE_CONTENT_MAX = 500_000;
const MAX_PENDING_PER_CONVERSATION = 20;
const MAX_TASKS_PER_CHANGE = 50;
const MAX_SUBTASKS = 20;
const MAX_SPRINT_TASKS = 50;
const MAX_ROUTINE_ITEMS = 30;
const MAX_PLAN_BLOCKS = 20;
const LOCAL_DATE_TIME = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$";
const LOCAL_TIME = "^([01]\\d|2[0-3]):[0-5]\\d$";
const EVENT_ID = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(___\\d{4}-\\d{2}-\\d{2})?$";

const STATUS_LABELS = { todo: "To do", in_progress: "In progress", on_hold: "On hold", done: "Done" };
const PRIORITY_LABELS = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
const REPEAT_LABELS = { daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year" };

const REPEAT_FIELD = { type: "string", enum: ["daily", "weekly", "monthly"] };
const PROJECT_FIELD = uuidField("Only when the member names a project: its id from list_projects. Project members can see the item.");

function field(label, value) {
  return value ? { label, value } : null;
}

function buildCard(title, { fields = [], body = null, notice = null }) {
  return compact({ title, fields: fields.filter(Boolean), body, notice });
}

function shift(label, before, after) {
  return { label, value: `${before || "None"} → ${after || "None"}` };
}

function unique(values) {
  return [...new Set(values)];
}

function bulletList(lines) {
  return lines.map((line) => `- ${line}`).join("\n");
}

function counted(total, word) {
  return `${total} ${word}${total === 1 ? "" : "s"}`;
}

async function loadProject(db, userId, projectId) {
  const result = await db.query(
    `SELECT p.id, p.name,
            (SELECT COUNT(*)::int FROM project_members all_members WHERE all_members.project_id = p.id) AS member_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     WHERE p.id = $2`,
    [userId, projectId]
  );
  if (!result.rows[0]) throw new ToolInputError("No project with that id is visible to you.");
  return result.rows[0];
}

function sharingNotice(project) {
  return project?.member_count > 1 ? `Everyone in ${project.name} will be able to see this.` : null;
}

// Noon, so the day reads the same in the member's timezone and in the task
// list, which shows the UTC date of `due_date`.
function dueInstant(date, timeZone) {
  return zonedInputToDate(`${date}T12:00`, timeZone).toISOString();
}

// ---------- create_task ----------

async function prepareCreateTask(ctx, input) {
  const project = input.project_id ? await loadProject(ctx.db, ctx.userId, input.project_id) : null;
  return buildCard("Create task", {
    fields: [
      field("Title", input.title),
      field("Due", formatDay(input.due_date)),
      field("Priority", PRIORITY_LABELS[input.priority || "medium"]),
      field("Repeats", REPEAT_LABELS[input.repeats]),
      field("Project", project?.name),
    ],
    body: input.description ? { label: "Description", text: input.description } : null,
    notice: sharingNotice(project),
  });
}

async function applyCreateTask(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const projectId = input.project_id || null;
  if (projectId) await loadProject(db, userId, projectId);

  const task = await db.transaction(async (client) => {
    const position = projectId
      ? await client.query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE project_id = $1 AND parent_task_id IS NULL",
        [projectId]
      )
      : await client.query(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tasks WHERE user_id = $1 AND project_id IS NULL AND parent_task_id IS NULL",
        [userId]
      );
    const inserted = await client.query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date, project_id, position, recurrence_rule)
       VALUES ($1, $2, $3, 'todo', $4, $5, $6, $7, $8)
       RETURNING id, title`,
      [
        userId,
        input.title,
        input.description || null,
        input.priority || "medium",
        input.due_date ? dueInstant(input.due_date, timeZone) : null,
        projectId,
        position.rows[0].next_pos,
        input.repeats || null,
      ]
    );
    const created = inserted.rows[0];
    if (projectId) {
      await ctx.recordActivity({
        projectId,
        actorUserId: userId,
        action: "created",
        entityType: "task",
        entityId: created.id,
        entityTitle: created.title,
        db: client,
        strict: true,
      });
    }
    return created;
  });
  return { id: task.id, href: taskHref(task.id) };
}

// ---------- update_task ----------

const EDITABLE_TASK = `${projectScopedAccessCondition("t")} AND ${creatorOrProjectOwnerCondition("t")}`;

async function prepareUpdateTask(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const result = await db.query(
    `SELECT t.title, t.status, t.priority, t.recurrence_rule, t.project_id,
            to_char((t.due_date AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS due_local,
            ${creatorOrProjectOwnerCondition("t")} AS can_edit
     FROM tasks t
     WHERE t.id = $3 AND ${projectScopedAccessCondition("t")}`,
    [userId, timeZone, input.task_id]
  );
  const task = result.rows[0];
  if (!task) throw new ToolInputError("No task with that id is visible to you.");
  if (!task.can_edit) throw new ToolInputError("Only the task creator or project creator can edit this task.");
  if (input.due_date && input.clear_due_date) throw new ToolInputError("Give due_date or clear_due_date, not both");

  const fields = [];
  if (input.title && input.title !== task.title) fields.push(shift("Title", task.title, input.title));
  if (input.status && input.status !== task.status) fields.push(shift("Status", STATUS_LABELS[task.status], STATUS_LABELS[input.status]));
  if (input.priority && input.priority !== task.priority) fields.push(shift("Priority", PRIORITY_LABELS[task.priority], PRIORITY_LABELS[input.priority]));
  if (input.due_date && input.due_date !== task.due_local) fields.push(shift("Due", formatDay(task.due_local), formatDay(input.due_date)));
  if (input.clear_due_date && task.due_local) fields.push(shift("Due", formatDay(task.due_local), null));
  if (fields.length === 0 && !input.description) throw new ToolInputError("That wouldn't change anything on this task.");

  return buildCard("Update task", {
    fields: [field("Task", task.title), ...fields],
    body: input.description ? { label: "New description", text: input.description } : null,
    notice: input.status === "done" && task.status !== "done" && task.recurrence_rule
      ? "This task repeats, so the next one will be created."
      : null,
  });
}

async function applyUpdateTask(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const task = await db.transaction(async (client) => {
    const locked = await client.query(
      `SELECT t.* FROM tasks t WHERE t.id = $2 AND ${EDITABLE_TASK} FOR UPDATE OF t`,
      [userId, input.task_id]
    );
    const before = locked.rows[0];
    if (!before) throw new ToolInputError("This task is no longer available to you.");

    const dueDate = input.clear_due_date ? null : input.due_date ? dueInstant(input.due_date, timeZone) : undefined;
    const changes = [
      ["title", input.title],
      ["description", input.description],
      ["status", input.status],
      ["priority", input.priority],
      ["due_date", dueDate],
    ].filter(([, value]) => value !== undefined);
    const assignments = changes.map(([column], index) => `${column} = $${index + 2}`);
    const updated = await client.query(
      `UPDATE tasks SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
      [before.id, ...changes.map(([, value]) => value)]
    );
    const after = updated.rows[0];

    const becameDone = input.status === "done" && before.status !== "done";
    if (becameDone && after.recurrence_rule) await createNextRecurringTask(client, after);
    if (after.project_id) {
      await ctx.recordActivity({
        projectId: after.project_id,
        actorUserId: userId,
        action: becameDone ? "completed" : "updated",
        entityType: "task",
        entityId: after.id,
        entityTitle: after.title,
        db: client,
        strict: true,
      });
    }
    return after;
  });
  return { id: task.id, href: taskHref(task.id) };
}

// ---------- move_tasks ----------

async function prepareMoveTasks(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const taskIds = unique(input.task_ids);
  const result = await db.query(
    `SELECT t.id, t.title, t.status,
            to_char((t.due_date AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS due_local,
            ${creatorOrProjectOwnerCondition("t")} AS can_edit
     FROM tasks t
     WHERE t.id = ANY($3::uuid[]) AND ${projectScopedAccessCondition("t")}
       AND t.parent_task_id IS NULL AND t.is_archived = FALSE
     ORDER BY t.due_date NULLS LAST, t.id`,
    [userId, timeZone, taskIds]
  );
  if (result.rows.length !== taskIds.length) throw new ToolInputError("Not all of those task ids are visible to you. Look the tasks up again.");
  const locked = result.rows.filter((task) => !task.can_edit);
  if (locked.length > 0) {
    throw new ToolInputError(`Only the task creator or project creator can edit: ${locked.map((task) => task.title).join(", ")}`);
  }
  const done = result.rows.filter((task) => task.status === "done");
  if (done.length > 0) throw new ToolInputError(`These are already done, so leave them out: ${done.map((task) => task.title).join(", ")}`);

  const moving = result.rows.filter((task) => task.due_local !== input.due_date);
  if (moving.length === 0) throw new ToolInputError("Those tasks are already due that day.");
  return buildCard(`Move ${counted(moving.length, "task")}`, {
    fields: [field("New due", formatDay(input.due_date))],
    body: {
      label: "Tasks",
      text: bulletList(moving.map((task) => `${task.title} (${task.due_local ? `was ${formatDay(task.due_local)}` : "no due date"})`)),
    },
  });
}

async function applyMoveTasks(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const taskIds = unique(input.task_ids);
  await db.transaction(async (client) => {
    const locked = await client.query(
      `SELECT t.id, t.title, t.project_id FROM tasks t WHERE t.id = ANY($2::uuid[]) AND ${EDITABLE_TASK} FOR UPDATE OF t`,
      [userId, taskIds]
    );
    if (locked.rows.length !== taskIds.length) {
      throw new ToolInputError("Some of these tasks are no longer available to you, so none were moved.");
    }
    await client.query("UPDATE tasks SET due_date = $2 WHERE id = ANY($1::uuid[])", [taskIds, dueInstant(input.due_date, timeZone)]);
    for (const task of locked.rows) {
      if (!task.project_id) continue;
      await ctx.recordActivity({
        projectId: task.project_id,
        actorUserId: userId,
        action: "updated",
        entityType: "task",
        entityId: task.id,
        entityTitle: task.title,
        db: client,
        strict: true,
      });
    }
  });
  return { href: "/tasks" };
}

// ---------- add_subtasks ----------

// Anyone who can see a task can add subtasks to it, as in the subtasks route.
async function prepareAddSubtasks(ctx, input) {
  const { db, userId } = ctx;
  const result = await db.query(
    `SELECT t.title, t.parent_task_id, t.project_id, p.name AS project_name,
            (SELECT COUNT(*)::int FROM project_members all_members WHERE all_members.project_id = t.project_id) AS member_count
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $2 AND ${projectScopedAccessCondition("t")}`,
    [userId, input.task_id]
  );
  const task = result.rows[0];
  if (!task) throw new ToolInputError("No task with that id is visible to you.");
  if (task.parent_task_id) throw new ToolInputError("That is already a subtask, and subtasks can't have their own.");
  return buildCard(`Add ${counted(input.titles.length, "subtask")}`, {
    fields: [field("Task", task.title), field("Project", task.project_name)],
    body: { label: "Subtasks", text: bulletList(input.titles) },
    notice: sharingNotice(task.project_id ? { name: task.project_name, member_count: task.member_count } : null),
  });
}

async function applyAddSubtasks(ctx, input) {
  const { db, userId } = ctx;
  await db.transaction(async (client) => {
    const locked = await client.query(
      `SELECT t.id, t.title, t.project_id FROM tasks t
       WHERE t.id = $2 AND t.parent_task_id IS NULL AND ${projectScopedAccessCondition("t")}
       FOR UPDATE OF t`,
      [userId, input.task_id]
    );
    const parent = locked.rows[0];
    if (!parent) throw new ToolInputError("This task is no longer available to you.");
    const position = await client.query(
      "SELECT COALESCE(MAX(position), 0) AS last_pos FROM tasks WHERE parent_task_id = $1",
      [parent.id]
    );
    for (const [index, title] of input.titles.entries()) {
      await client.query(
        `INSERT INTO tasks (user_id, parent_task_id, title, status, position, project_id)
         VALUES ($1, $2, $3, 'todo', $4, $5)`,
        [userId, parent.id, title, position.rows[0].last_pos + index + 1, parent.project_id]
      );
    }
    if (parent.project_id) {
      await ctx.recordActivity({
        projectId: parent.project_id,
        actorUserId: userId,
        action: "updated",
        entityType: "task",
        entityId: parent.id,
        entityTitle: parent.title,
        db: client,
        strict: true,
      });
    }
  });
  return { id: input.task_id, href: taskHref(input.task_id) };
}

// ---------- add_to_sprint ----------

async function prepareAddToSprint(ctx, input) {
  const { db, userId } = ctx;
  const sprintResult = await db.query(
    "SELECT name, status, start_date, end_date FROM sprints WHERE user_id = $1 AND id = $2",
    [userId, input.sprint_id]
  );
  const sprint = sprintResult.rows[0];
  if (!sprint) throw new ToolInputError("No sprint with that id is yours.");
  if (sprint.status === "completed") throw new ToolInputError("That sprint is closed.");

  const taskIds = unique(input.task_ids);
  const result = await db.query(
    `SELECT t.id, t.title, st.sprint_id AS current_sprint_id, s.name AS current_sprint
     FROM tasks t
     LEFT JOIN sprint_tasks st ON st.task_id = t.id AND st.user_id = $1 AND st.outcome IS NULL
     LEFT JOIN sprints s ON s.id = st.sprint_id
     WHERE t.id = ANY($2::uuid[])
       AND ${projectScopedAccessCondition("t")}
       AND ${creatorOrProjectOwnerCondition("t")}
       AND t.parent_task_id IS NULL
       AND t.is_archived = FALSE
       AND t.status <> 'done'
     ORDER BY t.due_date NULLS LAST, t.id`,
    [userId, taskIds]
  );
  if (result.rows.length !== taskIds.length) throw new ToolInputError("Only open tasks the member can edit can join a sprint.");
  const adding = result.rows.filter((task) => task.current_sprint_id !== input.sprint_id);
  if (adding.length === 0) throw new ToolInputError("Those tasks are already in that sprint.");

  return buildCard("Add to sprint", {
    fields: [
      field("Sprint", sprint.name),
      field("Dates", `${formatDay(sprint.start_date)} to ${formatDay(sprint.end_date)}`),
    ],
    body: {
      label: "Tasks",
      text: bulletList(adding.map((task) => (task.current_sprint ? `${task.title} (moves from ${task.current_sprint})` : task.title))),
    },
  });
}

async function applyAddToSprint(ctx, input) {
  const { db, userId } = ctx;
  const result = await db.transaction((client) => addTasksToSprint(client, userId, input.sprint_id, unique(input.task_ids)));
  if (result.error) throw new ToolInputError(result.error);
  return { id: input.sprint_id, href: "/sprints" };
}

// ---------- complete_routine ----------

async function prepareCompleteRoutine(ctx, input) {
  const { db, userId, today } = ctx;
  if (input.date > today) throw new ToolInputError("Routines can't be checked off for a day that hasn't happened yet.");
  const done = input.done !== false;
  const itemIds = unique(input.item_ids);
  const result = await db.query(
    `SELECT ci.id, ci.name, COALESCE(cl.completed, FALSE) AS done
     FROM checklist_items ci
     JOIN checklist_sections cs ON cs.id = ci.section_id
     LEFT JOIN checklist_logs cl ON cl.item_id = ci.id AND cl.log_date = $3::date
     WHERE ci.id = ANY($2::uuid[]) AND cs.user_id = $1
     ORDER BY cs.position, ci.position, ci.created_at`,
    [userId, itemIds, input.date]
  );
  if (result.rows.length !== itemIds.length) throw new ToolInputError("Not all of those routine item ids are yours. Look them up with get_agenda.");
  const changing = result.rows.filter((item) => item.done !== done);
  if (changing.length === 0) throw new ToolInputError(`Those are already ${done ? "checked off" : "unchecked"} for that day.`);
  return buildCard(done ? "Check off routine" : "Uncheck routine", {
    fields: [field("Day", formatDay(input.date))],
    body: { label: "Items", text: bulletList(changing.map((item) => item.name)) },
  });
}

async function applyCompleteRoutine(ctx, input) {
  const { db, userId } = ctx;
  const result = await db.query(
    `INSERT INTO checklist_logs (item_id, log_date, completed)
     SELECT ci.id, $3::date, $4
     FROM checklist_items ci
     JOIN checklist_sections cs ON cs.id = ci.section_id
     WHERE ci.id = ANY($2::uuid[]) AND cs.user_id = $1
     ON CONFLICT (item_id, log_date) DO UPDATE SET completed = EXCLUDED.completed
     RETURNING item_id`,
    [userId, unique(input.item_ids), input.date, input.done !== false]
  );
  if (result.rows.length === 0) throw new ToolInputError("These routine items no longer exist.");
  return { href: "/routines" };
}

// ---------- save_memory ----------

async function prepareSaveMemory(ctx, input) {
  const memories = await listMemories(ctx.db, ctx.userId);
  if (memories.length >= MEMORY_ITEMS_MAX) {
    throw new ToolInputError(`The member already has ${MEMORY_ITEMS_MAX} memories, the most allowed. They can remove some in Settings.`);
  }
  if (memories.some((memory) => memory.content.toLowerCase() === input.text.toLowerCase())) {
    throw new ToolInputError("That is already saved.");
  }
  return buildCard("Save to memory", {
    body: { label: "Remember", text: input.text },
    notice: "The assistant reads this in every new conversation. You can remove it in Settings.",
  });
}

async function applySaveMemory(ctx, input) {
  const memory = await addMemory(ctx.db, ctx.userId, input.text);
  return { id: memory.id, href: "/settings" };
}

// ---------- create_note ----------

async function findJournalEntry(db, userId, date) {
  const result = await db.query(
    `SELECT id FROM notes
     WHERE user_id = $1 AND project_id IS NULL AND is_journal = TRUE AND journal_date = $2::date
     LIMIT 1`,
    [userId, date]
  );
  return result.rows[0] || null;
}

// Matches the title the Notes page gives a new journal entry.
function journalTitle(date) {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  return `Journal — ${label}`;
}

function noteTitle(input) {
  return input.title || (input.journal_date ? journalTitle(input.journal_date) : null);
}

async function prepareCreateNote(ctx, input) {
  const { db, userId } = ctx;
  if (!noteTitle(input)) throw new ToolInputError("title is required");
  if (input.journal_date && input.project_id) throw new ToolInputError("Journal entries are personal, so they can't go in a project");
  if (input.journal_date) {
    const existing = await findJournalEntry(db, userId, input.journal_date);
    if (existing) throw new ToolInputError(`There is already a journal entry for that day. Use append_to_note with note_id ${existing.id}.`);
  }
  const project = input.project_id ? await loadProject(db, userId, input.project_id) : null;
  return buildCard(input.journal_date ? "Write journal entry" : "Create note", {
    fields: [field("Title", noteTitle(input)), field("Project", project?.name)],
    body: { label: "Text", text: input.text },
    notice: sharingNotice(project),
  });
}

async function applyCreateNote(ctx, input) {
  const { db, userId } = ctx;
  const projectId = input.project_id || null;
  if (projectId) await loadProject(db, userId, projectId);
  if (input.journal_date && await findJournalEntry(db, userId, input.journal_date)) {
    throw new ToolInputError("There is already a journal entry for that day.");
  }
  const { html, blocks } = textToNote(input.text);
  const note = await db.transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO notes (user_id, project_id, title, content, content_blocks, is_journal, journal_date, updated_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $1)
       RETURNING id, project_id, title`,
      [userId, projectId, noteTitle(input), html, JSON.stringify(blocks), Boolean(input.journal_date), input.journal_date || null]
    );
    const created = inserted.rows[0];
    if (projectId) {
      await ctx.recordActivity({
        projectId,
        actorUserId: userId,
        action: "created",
        entityType: "note",
        entityId: created.id,
        entityTitle: created.title,
        db: client,
        strict: true,
      });
    }
    return created;
  });
  return { id: note.id, href: noteHref(note) };
}

// ---------- append_to_note ----------

const EDITABLE_NOTE = `${projectScopedAccessCondition("n")} AND ${creatorOrProjectOwnerCondition("n")}`;

async function prepareAppendToNote(ctx, input) {
  const { db, userId } = ctx;
  const result = await db.query(
    `SELECT n.title, ${creatorOrProjectOwnerCondition("n")} AS can_edit, p.id AS project_id, p.name AS project_name,
            (SELECT COUNT(*)::int FROM project_members all_members WHERE all_members.project_id = n.project_id) AS member_count
     FROM notes n
     LEFT JOIN projects p ON p.id = n.project_id
     WHERE n.id = $2 AND ${projectScopedAccessCondition("n")}`,
    [userId, input.note_id]
  );
  const note = result.rows[0];
  if (!note) throw new ToolInputError("No note with that id is visible to you.");
  if (!note.can_edit) throw new ToolInputError("Only the note creator or project creator can edit this note.");
  return buildCard("Add to note", {
    fields: [field("Note", note.title), field("Project", note.project_name)],
    body: { label: "Added at the end", text: input.text },
    notice: sharingNotice(note.project_id ? { name: note.project_name, member_count: note.member_count } : null),
  });
}

async function applyAppendToNote(ctx, input) {
  const { db, userId } = ctx;
  const note = await db.transaction(async (client) => {
    const locked = await client.query(
      `SELECT n.* FROM notes n WHERE n.id = $2 AND ${EDITABLE_NOTE} FOR UPDATE OF n`,
      [userId, input.note_id]
    );
    const before = locked.rows[0];
    if (!before) throw new ToolInputError("This note is no longer available to you.");

    const { html, blocks } = textToNote(input.text);
    const content = `${before.content || ""}${html}`;
    if (content.length > NOTE_CONTENT_MAX) throw new ToolInputError("This note is too large to add to.");
    // A note without blocks yet keeps none: the editor builds them from the HTML.
    const contentBlocks = Array.isArray(before.content_blocks) && before.content_blocks.length > 0
      ? [...withoutTrailingBlanks(before.content_blocks), ...blocks]
      : null;

    // Forced, so the note can always be restored to how it was before this.
    await snapshotNoteBeforeChange(client, before, { force: true });
    const updated = await client.query(
      `UPDATE notes
       SET content = $2, content_blocks = $3::jsonb, revision = revision + 1, updated_by = $4
       WHERE id = $1
       RETURNING id, project_id, title`,
      [before.id, content, contentBlocks && JSON.stringify(contentBlocks), userId]
    );
    const after = updated.rows[0];
    if (after.project_id) {
      await ctx.recordActivity({
        projectId: after.project_id,
        actorUserId: userId,
        action: "updated",
        entityType: "note",
        entityId: after.id,
        entityTitle: after.title,
        db: client,
        strict: true,
      });
    }
    return after;
  });
  return { id: note.id, href: noteHref(note) };
}

// ---------- create_event ----------

function localInstant(value, timeZone) {
  try {
    return zonedInputToDate(value, timeZone);
  } catch {
    throw new ToolInputError(`${value} isn't a time that exists in the member's timezone`);
  }
}

// All-day events are stored the way the calendar's own form stores them: from
// midnight UTC on the first day to midnight UTC after the last.
function eventTimes(input, timeZone) {
  const isAllDay = Boolean(input.date);
  if (isAllDay === Boolean(input.start || input.end)) {
    throw new ToolInputError("Give start and end for a timed event, or date for an all-day event");
  }
  if (isAllDay) {
    const lastDay = input.end_date || input.date;
    if (lastDay < input.date) throw new ToolInputError("end_date must be on or after date");
    return {
      all_day: true,
      start_time: `${input.date}T00:00:00.000Z`,
      end_time: `${addDateDays(lastDay, 1)}T00:00:00.000Z`,
    };
  }
  if (!input.start || !input.end) throw new ToolInputError("A timed event needs both start and end");
  if (input.end_date) throw new ToolInputError("end_date is only for all-day events");
  const start = localInstant(input.start, timeZone);
  const end = localInstant(input.end, timeZone);
  if (end <= start) throw new ToolInputError("end must be after start");
  return { all_day: false, start_time: start.toISOString(), end_time: end.toISOString() };
}

async function defaultCalendar(db, userId) {
  const result = await db.query("SELECT name, google_calendar_id FROM calendars WHERE user_id = $1 AND is_default = TRUE LIMIT 1", [userId]);
  return result.rows[0] || null;
}

function formatWhen(input) {
  if (input.date) {
    return input.end_date && input.end_date !== input.date
      ? `${formatDay(input.date)} to ${formatDay(input.end_date)}, all day`
      : `${formatDay(input.date)}, all day`;
  }
  const [startDay, startTime] = input.start.split("T");
  const [endDay, endTime] = input.end.split("T");
  return startDay === endDay
    ? `${formatDay(startDay)}, ${startTime} to ${endTime}`
    : `${formatDay(startDay)} ${startTime} to ${formatDay(endDay)} ${endTime}`;
}

async function prepareCreateEvent(ctx, input) {
  const { db, userId, timeZone } = ctx;
  eventTimes(input, timeZone);
  const [project, linkedTask, calendarRow] = await Promise.all([
    input.project_id ? loadProject(db, userId, input.project_id) : null,
    input.task_id
      ? db.query(
        `SELECT t.title, t.project_id FROM tasks t WHERE t.id = $2 AND ${projectScopedAccessCondition("t")}`,
        [userId, input.task_id]
      )
      : null,
    defaultCalendar(db, userId),
  ]);
  const task = linkedTask?.rows[0] || null;
  if (input.task_id && !task) throw new ToolInputError("No task with that id is visible to you.");
  if (task && input.project_id && task.project_id !== input.project_id) {
    throw new ToolInputError("An event in a project can only link to tasks in that project");
  }
  const notices = [
    sharingNotice(project),
    calendarRow?.google_calendar_id ? "It will also be added to your Google Calendar." : null,
  ].filter(Boolean);

  return buildCard("Schedule event", {
    fields: [
      field("Title", input.title),
      field("When", formatWhen(input)),
      field("Repeats", REPEAT_LABELS[input.repeats]),
      field("Location", input.location),
      field("Calendar", calendarRow?.name),
      field("Project", project?.name),
      field("For task", task?.title),
    ],
    body: input.description ? { label: "Description", text: input.description } : null,
    notice: notices.join(" ") || null,
  });
}

async function applyCreateEvent(ctx, input) {
  const { event, googleError } = await ctx.createEvent({
    userId: ctx.userId,
    body: {
      title: input.title,
      description: input.description || null,
      location: input.location || null,
      ...eventTimes(input, ctx.timeZone),
      recurrence_rule: input.repeats || null,
      project_id: input.project_id || null,
      ...(input.task_id ? { task_ids: [input.task_id] } : {}),
    },
  });
  return compact({ id: event.id, href: "/calendar", warning: googleError });
}

// ---------- update_event ----------

function repeatLabel(rule) {
  if (!rule) return null;
  return REPEAT_LABELS[rule] || "On selected days";
}

async function loadEvent(db, userId, eventId) {
  const result = await db.query(
    `SELECT e.id, e.user_id, e.title, e.description, e.location, e.start_time, e.end_time, e.all_day,
            e.start_date, e.end_date, e.event_timezone, e.recurrence_rule, e.project_id, e.calendar_id,
            e.event_color, COALESCE(e.event_type, 'event') AS event_type,
            c.google_calendar_id, p.name AS project_name,
            (SELECT COUNT(*)::int FROM project_members all_members WHERE all_members.project_id = e.project_id) AS member_count,
            ${creatorOrProjectOwnerCondition("e")} AS can_edit
     FROM events e
     JOIN calendars c ON c.id = e.calendar_id
     LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.id = $2 AND ${projectScopedAccessCondition("e")}`,
    [userId, eventId]
  );
  return result.rows[0] || null;
}

// The occurrence a composite id points at, or the event itself. A repeating
// event has one row; its occurrences only exist when the rule is expanded.
function occurrenceOf(event, eventId) {
  if (!event.recurrence_rule || !isRecurrenceInstanceId(eventId)) return event;
  const day = eventId.split("___")[1];
  const instance = expandRecurrences(
    [event],
    new Date(`${addDateDays(day, -1)}T00:00:00Z`),
    new Date(`${addDateDays(day, 2)}T00:00:00Z`)
  ).find((item) => item.id === `${event.id}___${day}`);
  if (!instance) throw new ToolInputError("That occurrence isn't on the calendar. Look the event up again with get_agenda.");
  return instance;
}

// The stored end of an all-day event is the day after its last day.
function allDayRange(event) {
  const first = event.start_date || dateKey(new Date(event.start_time), "UTC");
  const end = event.end_date || dateKey(new Date(event.end_time), "UTC");
  return { first, last: addDateDays(end, -1) };
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// The new times for this occurrence, or null when the times aren't changing.
// Giving only a start keeps the length, so "move my 3pm to 4" needs one value.
function nextEventTimes(current, input, timeZone) {
  const timed = Boolean(input.start || input.end);
  const dated = Boolean(input.date || input.end_date);
  if (!timed && !dated) return null;
  if (timed && dated) throw new ToolInputError("Give start and end for a timed event, or date for an all-day event");

  if (dated) {
    if (!current.all_day && !input.date) throw new ToolInputError("end_date is only for all-day events");
    const range = current.all_day ? allDayRange(current) : null;
    const date = input.date || range.first;
    const lastDay = input.end_date || (range ? addDateDays(date, daysBetween(range.first, range.last)) : date);
    return eventTimes({ date, end_date: lastDay }, timeZone);
  }

  if (current.all_day && !(input.start && input.end)) throw new ToolInputError("A timed event needs both start and end");
  const length = new Date(current.end_time) - new Date(current.start_time);
  const start = input.start ? localInstant(input.start, timeZone) : new Date(current.start_time);
  const end = input.end ? localInstant(input.end, timeZone) : input.start ? new Date(start.getTime() + length) : new Date(current.end_time);
  if (end <= start) throw new ToolInputError("end must be after start");
  return { all_day: false, start_time: start.toISOString(), end_time: end.toISOString() };
}

function describeWhen(times, timeZone) {
  if (times.all_day) {
    const { first, last } = allDayRange(times);
    return formatWhen({ date: first, end_date: last });
  }
  return formatWhen({ start: datetimeInput(times.start_time, timeZone), end: datetimeInput(times.end_time, timeZone) });
}

// Moving a whole series moves its one row by however far this occurrence moved,
// so the series keeps its first date instead of restarting from this one.
function shiftedSeries(event, occurrence, next, timeZone) {
  if (next.all_day !== Boolean(event.all_day)) {
    throw new ToolInputError("A repeating event can't switch between all-day and timed here. The member can change that in Calendar.");
  }
  const zone = event.all_day ? "UTC" : timeZone;
  if (event.recurrence_rule.startsWith("custom") && dateKey(new Date(next.start_time), zone) !== dateKey(new Date(occurrence.start_time), zone)) {
    throw new ToolInputError("This event repeats on selected weekdays, so its days can only be changed in Calendar.");
  }
  const start = new Date(event.start_time).getTime() + (new Date(next.start_time) - new Date(occurrence.start_time));
  return {
    all_day: next.all_day,
    start_time: new Date(start).toISOString(),
    end_time: new Date(start + (new Date(next.end_time) - new Date(next.start_time))).toISOString(),
  };
}

async function resolveEventChange(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const event = await loadEvent(db, userId, getMasterEventId(input.event_id));
  if (!event) throw new ToolInputError("No event with that id is visible to you.");
  if (!event.can_edit) throw new ToolInputError("Only the event creator or project creator can edit this event.");
  if (event.recurrence_rule && !input.scope) {
    throw new ToolInputError("This event repeats. Ask the member whether to change only this occurrence or all of them, then set scope.");
  }
  const onlyThisOne = Boolean(event.recurrence_rule) && input.scope === "this";
  if (onlyThisOne && !isRecurrenceInstanceId(input.event_id)) {
    throw new ToolInputError("To change one occurrence, use its id from get_agenda, which ends in its date.");
  }
  const occurrence = occurrenceOf(event, input.event_id);
  const next = nextEventTimes(occurrence, input, timeZone);
  if (next && event.recurrence_rule && !onlyThisOne) shiftedSeries(event, occurrence, next, timeZone);
  return { event, occurrence, next, onlyThisOne };
}

async function prepareUpdateEvent(ctx, input) {
  const { event, occurrence, next, onlyThisOne } = await resolveEventChange(ctx, input);
  const before = describeWhen(occurrence, ctx.timeZone);
  const after = next && describeWhen(next, ctx.timeZone);
  const changes = [
    input.title && input.title !== event.title ? shift("Title", event.title, input.title) : null,
    after && after !== before ? shift("When", before, after) : null,
    input.location && input.location !== event.location ? shift("Location", event.location, input.location) : null,
  ].filter(Boolean);
  if (changes.length === 0 && !input.description) throw new ToolInputError("That wouldn't change anything on this event.");

  const repeats = Boolean(event.recurrence_rule);
  const notices = [
    repeats && onlyThisOne ? "Only this occurrence changes: it becomes its own event, and the original shows as cancelled." : null,
    repeats && !onlyThisOne ? "This changes every occurrence, including past ones." : null,
    sharingNotice(event.project_id ? { name: event.project_name, member_count: event.member_count } : null),
    event.google_calendar_id ? "Your Google Calendar will be updated too." : null,
  ].filter(Boolean);

  return buildCard(onlyThisOne ? "Change one occurrence" : "Change event", {
    fields: [
      field("Event", event.title),
      ...changes,
      changes.some((change) => change.label === "When") ? null : field("When", before),
      field("Repeats", repeats && !onlyThisOne ? repeatLabel(event.recurrence_rule) : null),
      field("Project", event.project_name),
    ],
    body: input.description ? { label: "New description", text: input.description } : null,
    notice: notices.join(" ") || null,
  });
}

// The calendar has no way to edit one occurrence of a series, so this one is
// cancelled and replaced by a separate event. The new event goes first: if the
// second step fails the member has a duplicate to tidy up, not a lost event.
async function replaceOccurrence(ctx, input, event, occurrence, next) {
  const { db, userId } = ctx;
  const linked = await db.query(
    `SELECT et.task_id FROM event_tasks et
     JOIN tasks t ON t.id = et.task_id
     WHERE et.event_id = $2 AND ${projectScopedAccessCondition("t")}`,
    [userId, event.id]
  );
  const { event: created, googleError } = await ctx.createEvent({
    userId,
    body: {
      title: input.title || event.title,
      description: input.description || event.description,
      location: input.location || event.location,
      ...(next || {
        all_day: Boolean(occurrence.all_day),
        start_time: new Date(occurrence.start_time).toISOString(),
        end_time: new Date(occurrence.end_time).toISOString(),
      }),
      recurrence_rule: null,
      project_id: event.project_id,
      event_type: event.event_type,
      ...(isReservedEventColor(event.event_color) ? {} : { event_color: event.event_color }),
      ...(event.user_id === userId ? { calendar_id: event.calendar_id } : {}),
      ...(linked.rows.length > 0 ? { task_ids: linked.rows.map((row) => row.task_id) } : {}),
    },
  });

  let warning = googleError;
  try {
    const cancelled = await ctx.updateEvent({ userId, id: input.event_id, body: { status: "cancelled" } });
    warning = warning || cancelled.googleError;
  } catch (error) {
    ctx.onError?.(error, "update_event");
    warning = "The new event is saved, but the original occurrence is still on your calendar. Cancel it there.";
  }
  return compact({ id: created.id, href: "/calendar", warning });
}

async function applyUpdateEvent(ctx, input) {
  const { userId, timeZone } = ctx;
  const { event, occurrence, next, onlyThisOne } = await resolveEventChange(ctx, input);
  if (onlyThisOne) return replaceOccurrence(ctx, input, event, occurrence, next);

  const times = next && event.recurrence_rule ? shiftedSeries(event, occurrence, next, timeZone) : next;
  const { googleError } = await ctx.updateEvent({
    userId,
    id: event.id,
    body: compact({ title: input.title, description: input.description, location: input.location, ...times }),
  });
  return compact({ id: event.id, href: "/calendar", warning: googleError });
}

// ---------- plan_my_day ----------

function planBlocks(input, timeZone) {
  const blocks = input.blocks.map((block) => {
    const start = localInstant(`${input.date}T${block.start}`, timeZone);
    const end = localInstant(`${input.date}T${block.end}`, timeZone);
    if (end <= start) throw new ToolInputError(`${block.title} must end after it starts`);
    return { ...block, start_time: start.toISOString(), end_time: end.toISOString() };
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  blocks.forEach((block, index) => {
    if (index > 0 && block.start_time < blocks[index - 1].end_time) {
      throw new ToolInputError(`${blocks[index - 1].title} and ${block.title} overlap`);
    }
  });
  return blocks;
}

async function preparePlanMyDay(ctx, input) {
  const { db, userId, timeZone, today } = ctx;
  if (input.date < today) throw new ToolInputError("A day that has passed can't be planned.");
  const blocks = planBlocks(input, timeZone);

  const [existing, events, calendar] = await Promise.all([
    db.query(
      "SELECT COUNT(*)::int AS total FROM events WHERE user_id = $1 AND source_key LIKE $2",
      [userId, `day-plan:${input.date}:%`]
    ),
    ctx.listEvents({ start: blocks[0].start_time, end: blocks.at(-1).end_time }),
    defaultCalendar(db, userId),
  ]);
  // A plan's own blocks are replaced, so they aren't clashes.
  const clashes = (events || []).filter((event) => !event.all_day
    && event.status !== "cancelled"
    && event.event_type !== "time_block"
    && blocks.some((block) => new Date(event.start_time) < new Date(block.end_time) && new Date(event.end_time) > new Date(block.start_time)));

  const replaced = existing.rows[0].total;
  const notices = [
    replaced > 0 ? `This replaces the ${counted(replaced, "planned block")} already on your calendar for that day.` : null,
    clashes.length > 0
      ? `It overlaps with ${clashes.map((event) => `${event.title} (${datetimeInput(event.start_time, timeZone).slice(11)})`).join(", ")}.`
      : null,
    calendar?.google_calendar_id ? "These will also be added to your Google Calendar." : null,
  ].filter(Boolean);

  return buildCard("Plan your day", {
    fields: [field("Day", formatDay(input.date))],
    body: { label: "Time blocks", text: blocks.map((block) => `${block.start}–${block.end} ${block.title}`).join("\n") },
    notice: notices.join(" ") || null,
  });
}

async function applyPlanMyDay(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const blocks = normalizeDayPlanBlocks(planBlocks(input, timeZone), input.date);
  // "edited" is how the app records a plan that isn't the saved template as is.
  const events = await db.transaction((client) => saveDayPlan(client, userId, { date: input.date, status: "edited", blocks }));
  const { googleError } = await ctx.syncDayPlan({ userId, eventIds: events.map((event) => event.id) });
  return compact({ href: "/calendar", warning: googleError });
}

// ---------- registry ----------

const NOTE_TEXT_HELP = "Plain text. Lines may start with #, ##, ###, -, - [ ] or 1., and **bold** works. Nothing else is formatted.";

const UNTIL_CONFIRMED = " Nothing changes until the member presses Confirm on the card they are shown.";

const localTimeField = (description) => ({ type: "string", pattern: LOCAL_TIME, description });

export const ACTION_TOOLS = [
  {
    name: "create_task",
    label: "Drafting a task",
    description: `Propose a new task.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 255 },
        description: { type: "string", maxLength: 10_000 },
        due_date: dateField("Due day, as YYYY-MM-DD in the member's timezone"),
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"], description: "Defaults to medium" },
        repeats: REPEAT_FIELD,
        project_id: PROJECT_FIELD,
      },
      required: ["title"],
      additionalProperties: false,
    },
    prepare: prepareCreateTask,
    apply: applyCreateTask,
  },
  {
    name: "update_task",
    label: "Drafting a task change",
    description: `Propose changes to one task: mark it done, reschedule it, reprioritise it or rename it.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        task_id: uuidField("The task id from another tool's result"),
        title: { type: "string", minLength: 1, maxLength: 255 },
        description: { type: "string", minLength: 1, maxLength: 10_000, description: "Replaces the whole description" },
        status: { type: "string", enum: ["todo", "in_progress", "on_hold", "done"] },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        due_date: dateField("New due day, as YYYY-MM-DD in the member's timezone"),
        clear_due_date: { type: "boolean", description: "Remove the due date" },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
    prepare: prepareUpdateTask,
    apply: applyUpdateTask,
  },
  {
    name: "create_note",
    label: "Drafting a note",
    description: `Propose a new note, or a journal entry for a date.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 255, description: "Required unless journal_date is given" },
        text: { type: "string", minLength: 1, maxLength: NOTE_TEXT_MAX, description: NOTE_TEXT_HELP },
        project_id: PROJECT_FIELD,
        journal_date: dateField("Makes this the journal entry for that day. Check with search_notes first."),
      },
      required: ["text"],
      additionalProperties: false,
    },
    prepare: prepareCreateNote,
    apply: applyCreateNote,
  },
  {
    name: "append_to_note",
    label: "Drafting an addition to a note",
    description: `Propose adding text to the end of a note or journal entry. Existing text is kept.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        note_id: uuidField("The note id from search_notes or another tool's result"),
        text: { type: "string", minLength: 1, maxLength: NOTE_TEXT_MAX, description: NOTE_TEXT_HELP },
      },
      required: ["note_id", "text"],
      additionalProperties: false,
    },
    prepare: prepareAppendToNote,
    apply: applyAppendToNote,
  },
  {
    name: "create_event",
    label: "Drafting an event",
    description: `Propose a calendar event. Give start and end for a timed event, or date for an all-day event.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 255 },
        start: { type: "string", pattern: LOCAL_DATE_TIME, description: "Start as YYYY-MM-DDTHH:MM, local to the member" },
        end: { type: "string", pattern: LOCAL_DATE_TIME, description: "End as YYYY-MM-DDTHH:MM, local to the member" },
        date: dateField("For an all-day event: the day, as YYYY-MM-DD"),
        end_date: dateField("For an all-day event over several days: the last day, inclusive"),
        description: { type: "string", maxLength: 10_000 },
        location: { type: "string", maxLength: 255 },
        repeats: REPEAT_FIELD,
        project_id: PROJECT_FIELD,
        task_id: uuidField("A task this event is time set aside for, from another tool's result"),
      },
      required: ["title"],
      additionalProperties: false,
    },
    prepare: prepareCreateEvent,
    apply: applyCreateEvent,
  },
  {
    name: "update_event",
    label: "Drafting an event change",
    description: `Propose changes to an event: move it, change its length, rename it, or change its location or description. Giving only start keeps its length.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        event_id: { type: "string", pattern: EVENT_ID, description: "The event id from get_agenda, exactly as given" },
        scope: {
          type: "string",
          enum: ["this", "all"],
          description: "Required when the event repeats: change only this occurrence, or all of them. Ask the member if they haven't said.",
        },
        title: { type: "string", minLength: 1, maxLength: 255 },
        start: { type: "string", pattern: LOCAL_DATE_TIME, description: "New start as YYYY-MM-DDTHH:MM, local to the member" },
        end: { type: "string", pattern: LOCAL_DATE_TIME, description: "New end as YYYY-MM-DDTHH:MM, local to the member" },
        date: dateField("Makes it all-day on this day, as YYYY-MM-DD"),
        end_date: dateField("For an all-day event over several days: the last day, inclusive"),
        location: { type: "string", minLength: 1, maxLength: 255 },
        description: { type: "string", minLength: 1, maxLength: 10_000, description: "Replaces the whole description" },
      },
      required: ["event_id"],
      additionalProperties: false,
    },
    prepare: prepareUpdateEvent,
    apply: applyUpdateEvent,
  },
  {
    name: "move_tasks",
    label: "Drafting a task move",
    description: `Propose giving several tasks the same new due date, on one card. Use it instead of several update_task calls.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        task_ids: {
          type: "array",
          minItems: 1,
          maxItems: MAX_TASKS_PER_CHANGE,
          items: uuidField("A task id from another tool's result"),
        },
        due_date: dateField("New due day, as YYYY-MM-DD in the member's timezone"),
      },
      required: ["task_ids", "due_date"],
      additionalProperties: false,
    },
    prepare: prepareMoveTasks,
    apply: applyMoveTasks,
  },
  {
    name: "add_subtasks",
    label: "Drafting subtasks",
    description: `Propose breaking a task into steps by adding subtasks to it, on one card. Check get_task first so you don't repeat ones it has.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        task_id: uuidField("The parent task id from another tool's result"),
        titles: {
          type: "array",
          minItems: 1,
          maxItems: MAX_SUBTASKS,
          items: { type: "string", minLength: 1, maxLength: 255 },
          description: "The subtasks, in the order they should be done",
        },
      },
      required: ["task_id", "titles"],
      additionalProperties: false,
    },
    prepare: prepareAddSubtasks,
    apply: applyAddSubtasks,
  },
  {
    name: "add_to_sprint",
    label: "Drafting a sprint change",
    description: `Propose adding open tasks to one of the member's sprints. A task already in another open sprint moves here.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        sprint_id: uuidField("The sprint id from get_sprint"),
        task_ids: {
          type: "array",
          minItems: 1,
          maxItems: MAX_SPRINT_TASKS,
          items: uuidField("A task id from another tool's result"),
        },
      },
      required: ["sprint_id", "task_ids"],
      additionalProperties: false,
    },
    prepare: prepareAddToSprint,
    apply: applyAddToSprint,
  },
  {
    name: "complete_routine",
    label: "Drafting a routine update",
    description: `Propose checking off routine items for a day, or unchecking them. Get their ids from get_agenda for that single day.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        item_ids: {
          type: "array",
          minItems: 1,
          maxItems: MAX_ROUTINE_ITEMS,
          items: uuidField("A routine item id from get_agenda"),
        },
        date: dateField("The day, as YYYY-MM-DD in the member's timezone"),
        done: { type: "boolean", description: "Defaults to true. False unchecks them." },
      },
      required: ["item_ids", "date"],
      additionalProperties: false,
    },
    prepare: prepareCompleteRoutine,
    apply: applyCompleteRoutine,
  },
  {
    name: "plan_my_day",
    label: "Drafting a day plan",
    description: `Propose time blocks for one day, which go on the calendar and replace any blocks an earlier plan put on that day. Read get_agenda and find_free_time first, and fit blocks around existing events.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        date: dateField("The day to plan, as YYYY-MM-DD in the member's timezone"),
        blocks: {
          type: "array",
          minItems: 1,
          maxItems: MAX_PLAN_BLOCKS,
          items: {
            type: "object",
            properties: {
              title: { type: "string", minLength: 1, maxLength: 255 },
              start: localTimeField("Start as HH:MM, local to the member"),
              end: localTimeField("End as HH:MM, local to the member"),
            },
            required: ["title", "start", "end"],
            additionalProperties: false,
          },
        },
      },
      required: ["date", "blocks"],
      additionalProperties: false,
    },
    prepare: preparePlanMyDay,
    apply: applyPlanMyDay,
  },
  {
    name: "save_memory",
    label: "Drafting a memory",
    description: `Propose saving a short note about the member for the assistant to read in every new conversation. Only when the member asks you to remember something.${UNTIL_CONFIRMED}`,
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: MEMORY_ITEM_MAX_LENGTH, description: "One short fact or preference, in plain words" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    prepare: prepareSaveMemory,
    apply: applySaveMemory,
  },
];

const ACTIONS_BY_NAME = new Map(ACTION_TOOLS.map((tool) => [tool.name, tool]));

// ---------- proposing and deciding ----------

// What the panel shows; the stored input stays on the server.
export function presentAction(row) {
  return compact({
    id: row.id,
    tool: row.tool,
    status: row.status,
    card: row.card,
    result: row.result,
  });
}

// Runs as a tool: stores the proposal, and tells the model it isn't done yet.
export async function proposeAction(ctx, tool, input) {
  const { db, userId, conversationId } = ctx;
  const card = await tool.prepare(ctx, input);
  const pending = await db.query(
    "SELECT COUNT(*)::int AS total FROM ai_actions WHERE chat_id = $1 AND status = 'pending'",
    [conversationId]
  );
  if (pending.rows[0].total >= MAX_PENDING_PER_CONVERSATION) {
    throw new ToolInputError("Too many proposals are waiting for the member. Ask them to confirm or cancel those first.");
  }
  const inserted = await db.query(
    `INSERT INTO ai_actions (chat_id, user_id, tool, input, card)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
     RETURNING id, tool, status, card, result`,
    [conversationId, userId, tool.name, JSON.stringify(input), JSON.stringify(card)]
  );
  const row = inserted.rows[0];
  return {
    action: presentAction(row),
    status: "awaiting_confirmation",
    proposal_id: row.id,
    note: "Nothing has changed yet. The member now sees this as a card with Confirm and Cancel buttons.",
  };
}

export async function listActions(db, conversationId) {
  const result = await db.query(
    "SELECT id, tool, status, card, result FROM ai_actions WHERE chat_id = $1 ORDER BY created_at, id",
    [conversationId]
  );
  return result.rows.map(presentAction);
}

// Expected failures carry a message written for the member: ToolInputError
// from here and EventRouteError (which has a status) from the events service.
function failureMessage(ctx, error, tool) {
  if (error instanceof ToolInputError || (Number.isInteger(error?.status) && error.status < 500)) return error.message;
  ctx.onError?.(error, tool);
  return "That couldn't be done. Try again, or make the change yourself.";
}

/**
 * The member's answer to a proposal. Moving the status off 'pending' is what
 * claims it, so a repeated click or a second tab gets the current state back
 * instead of applying the change again. A crash after the claim leaves it
 * 'applying' rather than retrying a change that may have gone through.
 * Returns null when this member has no such proposal.
 */
export async function decideAction(ctx, actionId, decision) {
  const { db, userId } = ctx;
  const claimed = await db.query(
    `UPDATE ai_actions SET status = $3, decided_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING id, tool, input, status, card, result`,
    [actionId, userId, decision === "confirm" ? "applying" : "cancelled"]
  );
  const row = claimed.rows[0];
  if (!row) {
    const current = await db.query(
      "SELECT id, tool, status, card, result FROM ai_actions WHERE id = $1 AND user_id = $2",
      [actionId, userId]
    );
    return current.rows[0] ? presentAction(current.rows[0]) : null;
  }
  if (decision !== "confirm") return presentAction(row);

  let status = "applied";
  let result;
  try {
    const tool = ACTIONS_BY_NAME.get(row.tool);
    if (!tool) throw new ToolInputError("This kind of change is no longer available.");
    result = await tool.apply(ctx, validateToolInput(tool.parameters, row.input));
  } catch (error) {
    status = "failed";
    result = { error: failureMessage(ctx, error, row.tool) };
  }
  const finished = await db.query(
    `UPDATE ai_actions SET status = $2, result = $3::jsonb, decided_at = NOW() WHERE id = $1
     RETURNING id, tool, status, card, result`,
    [row.id, status, JSON.stringify(result)]
  );
  return presentAction(finished.rows[0]);
}

function describeOutcome(row) {
  if (row.status === "pending") return "still waiting for the member to confirm or cancel. Don't propose it again unless they ask for a different version.";
  if (row.status === "cancelled") return "the member cancelled it. Don't propose it again unless they ask.";
  if (row.status === "applying") return "the member confirmed it, but it hasn't finished. Check before saying it's done.";
  if (row.status === "failed") return `the member confirmed it, but it failed: ${row.result?.error}`;
  const warning = row.result?.warning ? ` Warning: ${row.result.warning}` : "";
  const id = row.result?.id ? `id ${row.result.id}, ` : "";
  return `the member confirmed it and it's done. ${id}href ${row.result?.href}.${warning}`;
}

// What has happened to the model's proposals since the member's last message.
// It reads only tool names, ids and messages the server wrote: this note can
// reach the model as a system message, so it never repeats a proposal's text.
export async function actionUpdatesNote(db, conversationId, since) {
  const result = await db.query(
    `SELECT tool, status, result FROM ai_actions
     WHERE chat_id = $1 AND (status = 'pending' OR $2::timestamptz IS NULL OR decided_at > $2::timestamptz)
     ORDER BY created_at, id`,
    [conversationId, since ? new Date(since).toISOString() : null]
  );
  if (result.rows.length === 0) return null;
  const lines = result.rows.map((row) => `- ${row.tool}: ${describeOutcome(row)}`);
  return `Your proposals so far:\n${lines.join("\n")}`;
}
