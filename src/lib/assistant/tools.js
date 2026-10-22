import { projectScopedAccessCondition } from "../projectAccessSql.js";
import { cleanSearchText, searchWorkspace, SEARCH_QUERY_MAX_LENGTH } from "../workspaceSearch.js";
import { addDateDays, dateKey, zonedInputToDate, zonedParts } from "../calendarTime.js";
import { ToolInputError, dateField, uuidField, validateToolInput } from "./schema.js";

// Read-only tools the assistant can call. Every query is scoped to what the
// member can already open in Optimus: personal rows they created, and rows in
// projects they belong to (projectScopedAccessCondition, with $1 = user id).
//
// run(ctx, input) receives a validated input and
//   ctx = { db, userId, timeZone, today, listEvents({ start, end }) }
// and returns plain JSON for the model. Dates are given as local wall-clock
// values in the member's timezone, with weekdays, so the model never does
// timezone arithmetic.

const MAX_AGENDA_DAYS = 14;
const PRIORITY_ORDER = "CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NOTE_TEXT_LIMIT = 8_000;
const DESCRIPTION_LIMIT = 2_000;

// ---------- formatting ----------

function formatDay(key) {
  if (!key) return null;
  return `${WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()]} ${key}`;
}

function localDayKey(value, timeZone) {
  return value ? dateKey(value, timeZone) : null;
}

function formatLocalDateTime(value, timeZone) {
  const p = zonedParts(value, timeZone);
  return `${formatDay(`${p.year}-${p.month}-${p.day}`)} ${p.hour}:${p.minute}`;
}

function formatLocalTime(value, timeZone) {
  const p = zonedParts(value, timeZone);
  return `${p.hour}:${p.minute}`;
}

// The instant local midnight begins. A few zones skip midnight on a DST
// change, in which case the day starts an hour later.
function localDayStart(key, timeZone) {
  try {
    return zonedInputToDate(`${key}T00:00:00`, timeZone);
  } catch {
    return zonedInputToDate(`${key}T01:00:00`, timeZone);
  }
}

// Drops empty fields so results stay short. Zero counts and empty top-level
// lists are kept: they tell the model there is nothing, rather than nothing known.
function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

const listOrNull = (items) => (items.length > 0 ? items : null);

function truncateText(value, max) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'", apos: "'", nbsp: " " };

// Notes are stored as editor HTML. The model only needs the words and the
// line structure.
export function htmlToText(html) {
  return String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*\/(p|h[1-6]|ul|ol|div|blockquote|pre|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name) => ENTITIES[name])
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function taskHref(id) {
  return `/tasks?task_id=${id}`;
}

function noteHref(row) {
  const params = new URLSearchParams({ ...(row.project_id ? { project_id: row.project_id } : {}), note_id: row.id });
  return `/notes?${params.toString()}`;
}

function projectHref(id) {
  return `/projects?project_id=${id}`;
}

function presentTask(row) {
  return compact({
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due: formatDay(row.due_local),
    project: row.project_name,
    blocked_by_open_tasks: row.blocked_by || null,
    href: taskHref(row.id),
  });
}

const TASK_COLUMNS = `
  t.id, t.title, t.status, t.priority, t.project_id,
  to_char((t.due_date AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS due_local,
  p.name AS project_name,
  (SELECT COUNT(*)::int
     FROM task_dependencies td
     JOIN tasks dependency ON dependency.id = td.depends_on_task_id
    WHERE td.task_id = t.id AND dependency.status != 'done') AS blocked_by`;

const VISIBLE_TASK = `${projectScopedAccessCondition("t")} AND t.parent_task_id IS NULL AND t.is_archived = FALSE`;

// ---------- get_agenda ----------

function presentEvent(event, timeZone) {
  const allDay = Boolean(event.all_day);
  const startKey = allDay ? event.start_date || localDayKey(event.start_time, timeZone) : null;
  const endKey = allDay ? event.end_date || localDayKey(event.end_time, timeZone) : null;
  const sameDay = !allDay && localDayKey(event.start_time, timeZone) === localDayKey(event.end_time, timeZone);
  return compact({
    title: event.title,
    all_day: allDay || null,
    date: allDay ? formatDay(startKey) : null,
    until: allDay && endKey && endKey !== startKey ? formatDay(endKey) : null,
    starts: allDay ? null : formatLocalDateTime(event.start_time, timeZone),
    ends: allDay || !event.end_time ? null : sameDay ? formatLocalTime(event.end_time, timeZone) : formatLocalDateTime(event.end_time, timeZone),
    location: event.location,
    calendar: event.calendar_name,
    project: event.project_name,
    status: event.occurrence_status || event.status,
    linked_tasks: listOrNull((event.linked_tasks || []).map((task) => `${task.title} (${task.status})`)),
    href: "/calendar",
  });
}

async function loadRoutines(db, userId, startKey, endKey) {
  const [items, logs] = await Promise.all([
    db.query(
      `SELECT ci.id, ci.name, cs.name AS section
       FROM checklist_items ci
       JOIN checklist_sections cs ON cs.id = ci.section_id
       WHERE cs.user_id = $1
       ORDER BY cs.position, ci.position, ci.created_at`,
      [userId]
    ),
    db.query(
      `SELECT cl.item_id, to_char(cl.log_date, 'YYYY-MM-DD') AS log_date
       FROM checklist_logs cl
       JOIN checklist_items ci ON ci.id = cl.item_id
       JOIN checklist_sections cs ON cs.id = ci.section_id
       WHERE cs.user_id = $1 AND cl.completed = TRUE
         AND cl.log_date BETWEEN $2::date AND $3::date`,
      [userId, startKey, endKey]
    ),
  ]);
  if (items.rows.length === 0) return [];

  const done = new Set(logs.rows.map((row) => `${row.item_id}:${row.log_date}`));
  if (startKey === endKey) {
    return items.rows.map((item) => ({
      section: item.section,
      item: item.name,
      done: done.has(`${item.id}:${startKey}`),
    }));
  }
  const days = [];
  for (let key = startKey; key <= endKey; key = addDateDays(key, 1)) {
    days.push({
      date: formatDay(key),
      done: items.rows.filter((item) => done.has(`${item.id}:${key}`)).length,
      total: items.rows.length,
    });
  }
  return days;
}

async function loadDayPlan(db, userId, key) {
  const status = await db.query(
    "SELECT status FROM day_plan_logs WHERE user_id = $1 AND log_date = $2::date",
    [userId, key]
  );
  const state = status.rows[0]?.status || null;
  if (state === "rejected") return { status: "Skipped for this day." };
  if (state) return { status: "Applied. Its blocks are on the calendar as events." };

  const blocks = await db.query(
    `SELECT title, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
     FROM day_plan_blocks WHERE user_id = $1 ORDER BY position, start_time LIMIT 20`,
    [userId]
  );
  if (blocks.rows.length === 0) return null;
  return {
    status: "Not applied yet. These planned blocks are not on the calendar.",
    blocks: blocks.rows.map((block) => `${block.start_time}–${block.end_time} ${block.title}`),
  };
}

async function getAgenda(ctx, input) {
  const { db, userId, timeZone, today } = ctx;
  const startKey = input.start_date;
  const endKey = input.end_date || startKey;
  if (endKey < startKey) throw new ToolInputError("end_date must be on or after start_date");
  if (addDateDays(startKey, MAX_AGENDA_DAYS - 1) < endKey) {
    throw new ToolInputError(`The agenda covers at most ${MAX_AGENDA_DAYS} days; ask for a shorter range`);
  }

  const rangeStart = localDayStart(startKey, timeZone);
  const rangeEnd = localDayStart(addDateDays(endKey, 1), timeZone);
  const includesOpenWork = endKey >= today;

  const [events, due, overdue, inProgress, routines, dayPlan] = await Promise.all([
    ctx.listEvents({ start: rangeStart.toISOString(), end: rangeEnd.toISOString() }),
    db.query(
      `SELECT ${TASK_COLUMNS}
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE ${VISIBLE_TASK}
         AND t.due_date IS NOT NULL
         AND (t.due_date AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
       ORDER BY t.due_date, ${PRIORITY_ORDER}, t.id
       LIMIT 50`,
      [userId, timeZone, startKey, endKey]
    ),
    includesOpenWork
      ? db.query(
        `SELECT ${TASK_COLUMNS}, COUNT(*) OVER ()::int AS total
         FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
         WHERE ${VISIBLE_TASK}
           AND t.status != 'done'
           AND t.due_date IS NOT NULL
           AND (t.due_date AT TIME ZONE $2)::date < $3::date
         ORDER BY t.due_date, ${PRIORITY_ORDER}, t.id
         LIMIT 15`,
        [userId, timeZone, today]
      )
      : null,
    includesOpenWork
      ? db.query(
        `SELECT ${TASK_COLUMNS}
         FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
         WHERE ${VISIBLE_TASK}
           AND t.status = 'in_progress'
           AND (t.due_date IS NULL OR (t.due_date AT TIME ZONE $2)::date NOT BETWEEN $3::date AND $4::date)
         ORDER BY t.updated_at DESC, t.id
         LIMIT 10`,
        [userId, timeZone, startKey, endKey]
      )
      : null,
    loadRoutines(db, userId, startKey, endKey),
    startKey === endKey && endKey >= today ? loadDayPlan(db, userId, startKey) : null,
  ]);

  const eventList = (events || []).slice(0, 60).map((event) => presentEvent(event, timeZone));
  return compact({
    timezone: timeZone,
    range: startKey === endKey ? formatDay(startKey) : `${formatDay(startKey)} to ${formatDay(endKey)}`,
    events: eventList,
    tasks_due: due.rows.map(presentTask),
    overdue: overdue
      ? { total: overdue.rows[0]?.total || 0, tasks: overdue.rows.map(presentTask) }
      : null,
    in_progress_without_due_date_in_range: inProgress ? inProgress.rows.map(presentTask) : null,
    routines,
    day_plan: dayPlan,
  });
}

// ---------- search_tasks / get_task ----------

async function searchTasks(ctx, input) {
  const { db, userId, timeZone, today } = ctx;
  const params = [userId, timeZone];
  const conditions = [VISIBLE_TASK];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const status = input.status || "open";
  if (status === "open") conditions.push("t.status != 'done'");
  else if (status !== "any") conditions.push(`t.status = ${add(status)}`);
  if (input.priority) conditions.push(`t.priority = ${add(input.priority)}`);
  if (input.text) {
    const pattern = add(`%${escapeLike(input.text)}%`);
    conditions.push(`(t.title ILIKE ${pattern} ESCAPE '\\' OR t.description ILIKE ${pattern} ESCAPE '\\')`);
  }
  if (input.project) conditions.push(`p.name ILIKE ${add(`%${escapeLike(input.project)}%`)} ESCAPE '\\'`);
  if (input.due_from) conditions.push(`(t.due_date AT TIME ZONE $2)::date >= ${add(input.due_from)}::date`);
  if (input.due_to) conditions.push(`(t.due_date AT TIME ZONE $2)::date <= ${add(input.due_to)}::date`);
  if (input.overdue) {
    conditions.push(`t.status != 'done' AND t.due_date IS NOT NULL AND (t.due_date AT TIME ZONE $2)::date < ${add(today)}::date`);
  }
  const limit = add(input.limit || 15);

  const result = await db.query(
    `SELECT ${TASK_COLUMNS}, COUNT(*) OVER ()::int AS total
     FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.due_date NULLS LAST, ${PRIORITY_ORDER}, t.id
     LIMIT ${limit}`,
    params
  );
  return { total: result.rows[0]?.total || 0, tasks: result.rows.map(presentTask) };
}

async function getTask(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const result = await db.query(
    `SELECT ${TASK_COLUMNS}, t.description, t.recurrence_rule, t.user_id,
            to_char((t.updated_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS updated_local,
            creator.full_name AS creator_name
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN users creator ON creator.id = t.user_id
     WHERE t.id = $3 AND ${projectScopedAccessCondition("t")}`,
    [userId, timeZone, input.task_id]
  );
  const task = result.rows[0];
  if (!task) return { error: "No task with that id is visible to you." };

  const [subtasks, dependencies, tags] = await Promise.all([
    db.query(
      `SELECT t.title, t.status FROM tasks t
       WHERE t.parent_task_id = $2 AND ${projectScopedAccessCondition("t")}
       ORDER BY t.position, t.created_at`,
      [userId, task.id]
    ),
    db.query(
      `SELECT t.id, t.title, t.status FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = $2 AND ${projectScopedAccessCondition("t")}`,
      [userId, task.id]
    ),
    db.query(
      `SELECT tg.name FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id
       WHERE tt.task_id = $1 ORDER BY tg.name`,
      [task.id]
    ),
  ]);

  return compact({
    ...presentTask(task),
    description: truncateText(htmlToText(task.description), DESCRIPTION_LIMIT),
    repeats: task.recurrence_rule,
    created_by: task.project_id && task.user_id !== userId ? task.creator_name : null,
    last_updated: formatDay(task.updated_local),
    subtasks: listOrNull(subtasks.rows.map((row) => `${row.title} (${row.status})`)),
    depends_on: listOrNull(dependencies.rows.map((row) => ({ title: row.title, status: row.status, href: taskHref(row.id) }))),
    tags: listOrNull(tags.rows.map((row) => row.name)),
  });
}

// ---------- projects ----------

async function listProjects(ctx, input) {
  const { db, userId, timeZone, today } = ctx;
  const status = input.status || "active";
  const params = [userId, timeZone, today];
  const statusCondition = status === "all" ? "" : `AND p.status = $${params.push(status)}`;
  const result = await db.query(
    `SELECT p.id, p.name, p.status, p.type, p.end_date, (p.user_id = $1) AS is_owner,
            COUNT(t.id) FILTER (WHERE t.status != 'done')::int AS open_tasks,
            COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS done_tasks,
            COUNT(t.id) FILTER (
              WHERE t.status != 'done' AND t.due_date IS NOT NULL
                AND (t.due_date AT TIME ZONE $2)::date < $3::date
            )::int AS overdue_tasks,
            to_char(MIN((t.due_date AT TIME ZONE $2)::date) FILTER (WHERE t.status != 'done'), 'YYYY-MM-DD') AS next_due,
            (SELECT m.title || COALESCE(' (due ' || to_char(m.due_date, 'YYYY-MM-DD') || ')', '')
               FROM milestones m
              WHERE m.project_id = p.id AND m.is_completed = FALSE
              ORDER BY m.due_date NULLS LAST, m.position
              LIMIT 1) AS next_milestone
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     LEFT JOIN tasks t ON t.project_id = p.id AND t.parent_task_id IS NULL AND t.is_archived = FALSE
     WHERE p.is_archived = FALSE ${statusCondition}
     GROUP BY p.id
     ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, p.name
     LIMIT 30`,
    params
  );
  return {
    projects: result.rows.map((row) => compact({
      id: row.id,
      name: row.name,
      status: row.status,
      type: row.type,
      ends: formatDay(row.end_date),
      shared_with_you: !row.is_owner || null,
      open_tasks: row.open_tasks,
      done_tasks: row.done_tasks,
      overdue_tasks: row.overdue_tasks,
      next_task_due: formatDay(row.next_due),
      next_milestone: row.next_milestone,
      href: projectHref(row.id),
    })),
  };
}

async function getProject(ctx, input) {
  const { db, userId, timeZone, today } = ctx;
  const result = await db.query(
    `SELECT p.id, p.name, p.description, p.status, p.type, p.start_date, p.end_date, (p.user_id = $1) AS is_owner
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     WHERE p.id = $2`,
    [userId, input.project_id]
  );
  const project = result.rows[0];
  if (!project) return { error: "No project with that id is visible to you." };

  const [counts, openTasks, milestones, members] = await Promise.all([
    db.query(
      `SELECT COUNT(*) FILTER (WHERE t.status != 'done')::int AS open_tasks,
              COUNT(*) FILTER (WHERE t.status = 'done')::int AS done_tasks,
              COUNT(*) FILTER (
                WHERE t.status != 'done' AND t.due_date IS NOT NULL
                  AND (t.due_date AT TIME ZONE $2)::date < $3::date
              )::int AS overdue_tasks
       FROM tasks t
       WHERE t.project_id = $1 AND t.parent_task_id IS NULL AND t.is_archived = FALSE`,
      [project.id, timeZone, today]
    ),
    db.query(
      `SELECT ${TASK_COLUMNS}
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE ${VISIBLE_TASK} AND t.project_id = $3 AND t.status != 'done'
       ORDER BY t.due_date NULLS LAST, ${PRIORITY_ORDER}, t.position, t.id
       LIMIT 20`,
      [userId, timeZone, project.id]
    ),
    db.query(
      `SELECT title, due_date, is_completed FROM milestones
       WHERE project_id = $1 ORDER BY position, due_date NULLS LAST LIMIT 15`,
      [project.id]
    ),
    db.query(
      `SELECT u.full_name FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 ORDER BY pm.created_at`,
      [project.id]
    ),
  ]);

  return compact({
    id: project.id,
    name: project.name,
    status: project.status,
    type: project.type,
    description: truncateText(htmlToText(project.description), DESCRIPTION_LIMIT),
    starts: formatDay(project.start_date),
    ends: formatDay(project.end_date),
    shared_with_you: !project.is_owner || null,
    members: members.rows.map((row) => row.full_name),
    ...counts.rows[0],
    milestones: milestones.rows.map((row) => compact({
      title: row.title,
      due: formatDay(row.due_date),
      done: Boolean(row.is_completed),
    })),
    open_tasks_list: openTasks.rows.map(presentTask),
    href: projectHref(project.id),
  });
}

// ---------- notes ----------

function noteSnippet(text, needle) {
  if (!text) return "";
  const index = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (index < 0) return truncateText(text, 200);
  const start = Math.max(0, index - 80);
  return `${start > 0 ? "…" : ""}${truncateText(text.slice(start), 240)}`;
}

function presentNoteHeader(row, timeZone) {
  return compact({
    id: row.id,
    title: row.title,
    journal_entry_for: row.is_journal ? formatDay(row.journal_date) : null,
    notebook: row.notebook_name,
    project: row.project_name,
    last_updated: formatDay(localDayKey(row.updated_at, timeZone)),
    href: noteHref(row),
  });
}

const NOTE_COLUMNS = `
  n.id, n.title, n.content, n.project_id, n.is_journal, n.journal_date, n.updated_at,
  nb.name AS notebook_name, p.name AS project_name`;

const NOTE_JOINS = `
  FROM notes n
  LEFT JOIN notebooks nb ON nb.id = n.notebook_id AND nb.user_id = $1
  LEFT JOIN projects p ON p.id = n.project_id`;

async function searchNotes(ctx, input) {
  const { db, userId, timeZone } = ctx;
  if (!input.text && !input.journal_date) throw new ToolInputError("Give text, journal_date, or both");
  const params = [userId];
  const conditions = [projectScopedAccessCondition("n")];
  if (input.text) {
    params.push(`%${escapeLike(input.text)}%`);
    conditions.push(`(n.title ILIKE $${params.length} ESCAPE '\\' OR n.content ILIKE $${params.length} ESCAPE '\\')`);
  }
  if (input.journal_date) {
    params.push(input.journal_date);
    conditions.push(`n.is_journal = TRUE AND n.journal_date = $${params.length}::date`);
  }
  params.push(input.limit || 8);
  const result = await db.query(
    `SELECT ${NOTE_COLUMNS} ${NOTE_JOINS}
     WHERE ${conditions.join(" AND ")}
     ORDER BY n.updated_at DESC, n.id
     LIMIT $${params.length}`,
    params
  );
  return {
    notes: result.rows.map((row) => ({
      ...presentNoteHeader(row, timeZone),
      snippet: noteSnippet(htmlToText(row.content), input.text),
    })),
  };
}

async function readNote(ctx, input) {
  const { db, userId, timeZone } = ctx;
  const result = await db.query(
    `SELECT ${NOTE_COLUMNS} ${NOTE_JOINS}
     WHERE n.id = $2 AND ${projectScopedAccessCondition("n")}`,
    [userId, input.note_id]
  );
  const note = result.rows[0];
  if (!note) return { error: "No note with that id is visible to you." };
  const text = htmlToText(note.content);
  return compact({
    ...presentNoteHeader(note, timeZone),
    text: truncateText(text, NOTE_TEXT_LIMIT),
    truncated: text.length > NOTE_TEXT_LIMIT || null,
  });
}

// ---------- search_workspace ----------

async function searchEverything(ctx, input) {
  const q = cleanSearchText(input.text).slice(0, SEARCH_QUERY_MAX_LENGTH);
  if (q.length < 2) throw new ToolInputError("text must be at least 2 characters");
  const results = await searchWorkspace(ctx.db, ctx.userId, q);
  return {
    results: results.map((result) => compact({
      type: result.label,
      title: result.title,
      detail: result.description,
      meta: result.meta,
      href: result.href,
      url: result.externalUrl,
    })),
  };
}

// ---------- registry ----------

export const ASSISTANT_TOOLS = [
  {
    name: "get_agenda",
    label: "Checking your schedule",
    description:
      "The member's plan for a day or a range of up to 14 days: calendar events, tasks due, overdue and in-progress tasks, "
      + "routine checklist progress, and (for a single day) the day plan. Use it for questions such as what is on today, "
      + "what is coming up this week, or how busy a day is.",
    parameters: {
      type: "object",
      properties: {
        start_date: dateField("First day, as YYYY-MM-DD in the member's timezone"),
        end_date: dateField("Last day, inclusive. Omit for a single day."),
      },
      required: ["start_date"],
      additionalProperties: false,
    },
    run: getAgenda,
  },
  {
    name: "search_tasks",
    label: "Looking through tasks",
    description:
      "Find tasks by words, status, priority, project name or due dates. Returns up to 25 tasks and the total that matched. "
      + "Status defaults to open (anything not done).",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 2, maxLength: 200, description: "Words to match in the title or description" },
        status: { type: "string", enum: ["open", "todo", "in_progress", "on_hold", "done", "any"] },
        priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
        project: { type: "string", minLength: 2, maxLength: 255, description: "Part of a project name" },
        due_from: dateField("Earliest due date, inclusive"),
        due_to: dateField("Latest due date, inclusive"),
        overdue: { type: "boolean", description: "Only open tasks due before today" },
        limit: { type: "integer", minimum: 1, maximum: 25 },
      },
      additionalProperties: false,
    },
    run: searchTasks,
  },
  {
    name: "get_task",
    label: "Opening a task",
    description: "Full details of one task: description, subtasks, dependencies, tags and recurrence.",
    parameters: {
      type: "object",
      properties: { task_id: uuidField("The task id from another tool's result") },
      required: ["task_id"],
      additionalProperties: false,
    },
    run: getTask,
  },
  {
    name: "list_projects",
    label: "Checking projects",
    description:
      "Projects the member belongs to, with open, done and overdue task counts, the next due task and the next milestone.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "paused", "completed", "all"], description: "Defaults to active" },
      },
      additionalProperties: false,
    },
    run: listProjects,
  },
  {
    name: "get_project",
    label: "Opening a project",
    description: "One project in detail: description, dates, members, milestones and its open tasks.",
    parameters: {
      type: "object",
      properties: { project_id: uuidField("The project id from list_projects or another tool's result") },
      required: ["project_id"],
      additionalProperties: false,
    },
    run: getProject,
  },
  {
    name: "search_notes",
    label: "Searching notes",
    description:
      "Find notes and journal entries by words in the title or body, or the journal entry for a date. Returns snippets; "
      + "use read_note for the full text.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 2, maxLength: 200 },
        journal_date: dateField("Only the journal entry written for this date"),
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
    run: searchNotes,
  },
  {
    name: "read_note",
    label: "Reading a note",
    description: "The full text of one note or journal entry.",
    parameters: {
      type: "object",
      properties: { note_id: uuidField("The note id from search_notes or another tool's result") },
      required: ["note_id"],
      additionalProperties: false,
    },
    run: readNote,
  },
  {
    name: "search_workspace",
    label: "Searching your workspace",
    description:
      "Search everything at once: tasks, notes, projects, saved links and library resources. Use it when the member "
      + "names something without saying what kind of item it is, or asks about saved links and resources.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", minLength: 2, maxLength: SEARCH_QUERY_MAX_LENGTH } },
      required: ["text"],
      additionalProperties: false,
    },
    run: searchEverything,
  },
];

const TOOLS_BY_NAME = new Map(ASSISTANT_TOOLS.map((tool) => [tool.name, tool]));

// The provider-facing definitions, in a fixed order so the prompt cache holds.
export function toolDefinitions() {
  return ASSISTANT_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

export function toolLabel(name) {
  return TOOLS_BY_NAME.get(name)?.label || "Looking that up";
}

// Never throws: bad input and failures come back as an error result the model
// can read and recover from.
export async function runTool(ctx, name, input, { onError } = {}) {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return { output: { error: `There is no tool called ${name}.` }, isError: true };
  try {
    const value = validateToolInput(tool.parameters, input);
    const output = await tool.run(ctx, value);
    return { output, isError: Boolean(output?.error) };
  } catch (error) {
    if (error instanceof ToolInputError) return { output: { error: error.message }, isError: true };
    onError?.(error, name);
    return { output: { error: "That lookup failed. Try a different request." }, isError: true };
  }
}
