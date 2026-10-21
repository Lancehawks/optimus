"use client";

import { useState, useEffect, useCallback } from "react";
import { datetimeInput, dateKey, addDateDays, resolveTimeZone } from '@/lib/calendarTime';
import { editedTimedInstant, changedEventFields } from '@/lib/eventEdit';
import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import {
  CalendarDays,
  CalendarRange,
  Check,
  CircleDot,
  Clock3,
  FolderKanban,
  ListChecks,
  MapPin,
  Palette,
  Repeat2,
  Shapes,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input, Modal, SearchableSelect, Select, Textarea, Toggle, useToast } from "@/components/ui";
import { PriorityIcon, StatusIcon } from "@/components/tasks/TaskGlyphs";
import { taskService } from "@/services/api";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_EVENT_COLOR,
  EVENT_COLOR_OPTIONS,
  EVENT_STATUS_META,
  EVENT_STATUS_OPTIONS,
  FOCUS_BLOCK_COLOR,
  getEventDisplayColor,
  getEventDisplayStatus,
  getEventStatusMeta,
} from "@/lib/eventDisplay";

const RECURRENCE_OPTIONS = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom (weekdays)" },
];

const WEEKDAYS = [
  { key: "Mon", label: "M" },
  { key: "Tue", label: "T" },
  { key: "Wed", label: "W" },
  { key: "Thu", label: "T" },
  { key: "Fri", label: "F" },
  { key: "Sat", label: "S" },
  { key: "Sun", label: "S" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "focus", label: "Focus block" },
  { value: "time_block", label: "Time block" },
];

// Transform task API data to SearchableSelect format
function taskToSelectItem(task) {
  return {
    id: task.id,
    label: task.title,
    sublabel: task.status?.replace("_", " "),
    status: task.status,
    priority: task.priority,
  };
}

function formatDateLong(date, timeZone = 'UTC') {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

function sameLocalDate(a, b, timeZone = 'UTC') {
  if (!a || !b) return false;
  return dateKey(a, timeZone) === dateKey(b, timeZone);
}

function formatEventTimeRange(event, timeZone = 'UTC') {
  if (!event?.start_time || !event?.end_time) return "";

  if (event.all_day) {
    const start = event.start_date || String(event.start_time).slice(0,10);
    const end = addDateDays(event.end_date || String(event.end_time).slice(0,10), -1);
    return start === end ? `${formatDateLong(start)}, all day` : `${formatDateLong(start)} to ${formatDateLong(end)}, all day`;
  }

  return sameLocalDate(event.start_time, event.end_time, timeZone)
    ? `${formatDateLong(event.start_time, timeZone)}, ${formatTimeShort(event.start_time, timeZone)} to ${formatTimeShort(event.end_time, timeZone)}`
    : `${formatDateLong(event.start_time, timeZone)} ${formatTimeShort(event.start_time, timeZone)} - ${formatDateLong(event.end_time, timeZone)} ${formatTimeShort(event.end_time, timeZone)}`;
}

function formatRecurrence(rule) {
  if (!rule) return "Does not repeat";
  if (rule.startsWith("custom:")) {
    const days = rule.slice(7).split(",").filter(Boolean).join(", ");
    return days ? `Custom: ${days}` : "Custom";
  }
  return rule.charAt(0).toUpperCase() + rule.slice(1);
}

function DetailRow({ icon: Icon, label, children }) {
  if (!children) return null;

  return (
    <>
      <dt className="flex items-center gap-2 py-2 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="min-w-0 py-2 text-sm text-heading">{children}</dd>
    </>
  );
}

function Property({ icon: Icon, label, children, alignTop = false }) {
  return (
    <>
      <dt className={cn("flex gap-2 text-xs text-muted", alignTop ? "items-start pt-2" : "items-center")}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", alignTop && "mt-px")} />
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

const subtleField = "border-transparent! bg-transparent! shadow-none! hover:border-border! focus:border-brand-500!";

export default function EventModal({
  isOpen,
  onClose,
  event,
  calendars,
  defaultCalendarId,
  defaultStartTime,
  defaultDraft,
  onSave,
  onMarkDone,
  onDelete,
  isLoading,
}) {
  const isEditing = !!event;
  const { addToast } = useToast();
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [customDays, setCustomDays] = useState(new Set());
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [eventColor, setEventColor] = useState(DEFAULT_EVENT_COLOR);
  const [eventStatus, setEventStatus] = useState("scheduled");
  const [eventType, setEventType] = useState("event");
  const [markingDone, setMarkingDone] = useState(false);
  const { projects } = useProjects({ include_archived: "false" });

  useEffect(() => {
    if (!isOpen) return;

    if (event) {
      setTitle(event.title || "");
      setDescription(event.description || "");
      setLocation(event.location || "");
      setAllDay(event.all_day || false);
      setStartTime(datetimeInput(event.start_time, timeZone));
      setEndTime(datetimeInput(event.end_time, timeZone));
      setStartDate(event.all_day ? event.start_date || String(event.start_time).slice(0,10) : dateKey(event.start_time, timeZone));
      setEndDate(event.all_day ? addDateDays(event.end_date || String(event.end_time).slice(0,10), -1) : dateKey(event.end_time, timeZone));
      setCalendarId(event.calendar_id || "");
      setProjectId(event.project_id || "");
      setEventColor(event.event_color || DEFAULT_EVENT_COLOR);
      setEventStatus(event.status || "scheduled");
      setEventType(event.event_type || "event");

      // Parse recurrence rule
      const rule = event.recurrence_rule || "";
      if (rule.startsWith("custom:")) {
        setRecurrenceRule("custom");
        setCustomDays(new Set(rule.slice(7).split(",")));
      } else {
        setRecurrenceRule(rule);
        setCustomDays(new Set());
      }

      // Linked tasks
      setLinkedTasks(
        (event.linked_tasks || []).map(taskToSelectItem)
      );
    } else {
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(false);
      setCalendarId(defaultCalendarId || "");
      setProjectId(defaultDraft?.projectId || defaultDraft?.project_id || "");
      setRecurrenceRule("");
      setCustomDays(new Set());
      setLinkedTasks((defaultDraft?.linkedTasks || []).map(taskToSelectItem));
      setEventColor(defaultDraft?.event_color || defaultDraft?.color || DEFAULT_EVENT_COLOR);
      setEventStatus(defaultDraft?.status || "scheduled");
      setEventType(defaultDraft?.event_type || defaultDraft?.eventType || "event");
      setTitle(defaultDraft?.title || "");
      setDescription(defaultDraft?.description || "");
      setLocation(defaultDraft?.location || "");

      if (defaultDraft?.start_time && defaultDraft?.end_time) {
        const start = new Date(defaultDraft.start_time);
        const end = new Date(defaultDraft.end_time);
        setStartTime(datetimeInput(start, timeZone));
        setEndTime(datetimeInput(end, timeZone));
        setStartDate(dateKey(start, timeZone));
        setEndDate(dateKey(start, timeZone));
      } else if (defaultStartTime) {
        const start = new Date(defaultStartTime);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
        setStartTime(datetimeInput(start, timeZone));
        setEndTime(datetimeInput(end, timeZone));
        setStartDate(dateKey(start, timeZone));
        setEndDate(dateKey(start, timeZone));
      } else {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        const end = new Date(now.getTime() + 60 * 60 * 1000);
        setStartTime(datetimeInput(now, timeZone));
        setEndTime(datetimeInput(end, timeZone));
        setStartDate(dateKey(now, timeZone));
        setEndDate(dateKey(now, timeZone));
      }
    }
  }, [event, isOpen, defaultCalendarId, defaultStartTime, defaultDraft, timeZone]);

  // Task search handler for SearchableSelect
  const handleTaskSearch = useCallback(async (query, options = {}) => {
    const params = { limit: 10 };
    if (query.trim()) params.search = query;
    if (projectId) params.project_id = projectId;
    const res = await taskService.list(params, options);
    return (res.tasks || []).filter((t) => t.status !== "done").map(taskToSelectItem);
  }, [projectId]);

  function toggleCustomDay(day) {
    const next = new Set(customDays);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    setCustomDays(next);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim()) {
      addToast({ message: "Title is required", type: "error" });
      return;
    }

    // Build recurrence rule string
    let rule = recurrenceRule || null;
    if (recurrenceRule === "custom") {
      if (customDays.size === 0) {
        addToast({ message: "Select at least one day for custom recurrence", type: "error" });
        return;
      }
      rule = `custom:${[...customDays].join(",")}`;
    }

    let startISO, endISO;
    try {
      startISO = allDay ? startDate + 'T00:00:00.000Z' : editedTimedInstant(startTime, !event?.all_day && event?.start_time, timeZone);
      endISO = allDay ? addDateDays(endDate, 1) + 'T00:00:00.000Z' : editedTimedInstant(endTime, !event?.all_day && event?.end_time, timeZone);
      if (new Date(endISO) <= new Date(startISO)) throw new Error('End must be after start');
    } catch (error) {
      addToast({message: error.message, type: 'error'}); return;
    }
    const data = {
      title: title.trim(),
      description: description || null,
      location: location || null,
      all_day: allDay,
      start_time: startISO,
      end_time: endISO,
      calendar_id: calendarId || undefined,
      projectId: projectId || null,
      recurrence_rule: rule,
      task_ids: linkedTasks.map((t) => t.id),
      event_color: eventColor,
      status: eventStatus,
      event_type: eventType,
    };

    const payload = isEditing ? changedEventFields(event, data) : data;
    if (!Object.keys(payload).length) { onClose(); return; }
    await onSave?.(payload, isEditing ? (event._masterEventId || event.id) : null);
  }

  async function handleDelete() {
    if (!event) return;
    const id = event._masterEventId || event.id;
    if (event._isRecurrenceInstance) {
      if (!confirm("This will delete all occurrences of this recurring event. Continue?")) return;
    }
    await onDelete?.(id);
  }

  async function handleMarkDone() {
    if (!event || eventStatus === "done") return;

    setMarkingDone(true);
    try {
      const id = event.id;
      const saved = onMarkDone
        ? await onMarkDone(event)
        : await onSave?.({ status: "done" }, id);
      if (saved !== false) {
        setEventStatus("done");
      }
    } finally {
      setMarkingDone(false);
    }
  }

  const hasEventCalendar = calendars.some((c) => c.id === event?.calendar_id);
  const calendarOptions = [
    ...(event?.calendar_id && !hasEventCalendar
      ? [{
          value: event.calendar_id,
          label: event.calendar_name ? `${event.calendar_name} (project event)` : "Project event calendar",
        }]
      : []),
    ...calendars.map((c) => ({
      value: c.id,
      label: c.is_google ? c.name : `${c.name} (local only)`,
    })),
  ];
  const projectOptions = [
    { value: "", label: "No project (personal event)" },
    ...projects.map((project) => ({
      value: project.id,
      label: project.member_count > 1 ? `${project.name} (${project.member_count} members)` : project.name,
    })),
  ];
  const canEditEvent = !isEditing || event?.user_id === user?.id || event?.is_project_owner;
  const canDeleteEvent = isEditing && (
    event?.project_id ? Boolean(event?.is_project_owner) : event?.user_id === user?.id
  );
  const statusPreviewEvent = event
    ? {
        ...event,
        status: eventStatus,
        linked_tasks: linkedTasks.map((task) => ({
          id: task.id,
          title: task.label,
          status: task.status,
          priority: task.priority,
        })),
      }
    : null;
  const statusPreviewValue = statusPreviewEvent
    ? getEventDisplayStatus(statusPreviewEvent)
    : eventStatus;
  const statusPreviewMeta = statusPreviewEvent
    ? getEventStatusMeta(statusPreviewEvent)
    : EVENT_STATUS_META[eventStatus] || EVENT_STATUS_META.scheduled;
  const selectedColorName = EVENT_COLOR_OPTIONS.find(
    (color) => color.value === eventColor
  )?.name;
  const canMarkDone = isEditing && canEditEvent && eventStatus !== "done";

  function renderTaskChip(item) {
    return (
      <span
        key={item.id}
        className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-surface-secondary pl-1.5 pr-1 text-xs text-heading"
      >
        <StatusIcon status={item.status || "todo"} />
        <span className="max-w-[180px] truncate">{item.label}</span>
        {canEditEvent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLinkedTasks((prev) => prev.filter((t) => t.id !== item.id));
            }}
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-tertiary hover:text-heading"
            aria-label={`Unlink ${item.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }

  function renderTaskItem(item, isHighlighted) {
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (canEditEvent) setLinkedTasks((prev) => [...prev, item]);
        }}
        disabled={!canEditEvent}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-body transition-colors",
          isHighlighted ? "bg-surface-tertiary text-heading" : "hover:bg-surface-tertiary"
        )}
      >
        <StatusIcon status={item.status || "todo"} />
        <span className="flex-1 truncate">{item.label}</span>
        <PriorityIcon priority={item.priority} />
      </button>
    );
  }

  if (isEditing && !canEditEvent) {
    const viewerTasks = (event.linked_tasks || []).map(taskToSelectItem);
    const calendarName = event.calendar_name || calendars.find((c) => c.id === event.calendar_id)?.name;
    const calendarColor = event.calendar_color || calendars.find((c) => c.id === event.calendar_id)?.color || "#0d6b88";
    const projectName = event.project_name || projects.find((project) => project.id === event.project_id)?.name;
    const projectColor = event.project_color || projects.find((project) => project.id === event.project_id)?.color || "#0d6b88";
    const displayColor = getEventDisplayColor(event, event.project_id ? projectColor : calendarColor);
    const statusMeta = getEventStatusMeta(event);

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Event · view only"
        size="lg"
        placement="right"
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        <div className="flex items-start gap-3">
          <span className="mt-3 h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: displayColor }} />
          <h3 className="font-serif text-[1.75rem] leading-9 text-heading">{event.title || "Untitled event"}</h3>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn("badge", statusMeta.className)}>{statusMeta.label}</span>
          {projectName && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: projectColor }} />
              {projectName}
            </span>
          )}
          {calendarName && <span className="text-xs text-muted">· {calendarName}</span>}
        </div>

        <dl className="mt-6 grid grid-cols-[6.5rem_1fr] gap-x-3 border-y border-border py-2">
          <DetailRow label="When" icon={Clock3}>{formatEventTimeRange(event, timeZone)}</DetailRow>
          <DetailRow label="Location" icon={MapPin}>{event.location}</DetailRow>
          <DetailRow label="Repeat" icon={Repeat2}>{formatRecurrence(event.recurrence_rule)}</DetailRow>
          <DetailRow label="Tasks" icon={ListChecks}>
            {viewerTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewerTasks.map((task) => (
                  <span key={task.id} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border px-1.5 text-xs">
                    <StatusIcon status={task.status || "todo"} />
                    {task.label}
                  </span>
                ))}
              </div>
            )}
          </DetailRow>
        </dl>
        {event.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-body">{event.description}</p>}
      </Modal>
    );
  }

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <div>
        {canDeleteEvent && (
          <Button variant="ghost" onClick={handleDelete} leftIcon={<Trash2 />} className="text-danger! hover:bg-danger-light!">
            {event?._isRecurrenceInstance ? "Delete series" : "Delete"}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClose}>{canEditEvent ? "Cancel" : "Close"}</Button>
        {canEditEvent && (
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {isEditing ? "Save changes" : "Create event"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Event" : "New event"}
      size="lg"
      placement="right"
      footer={footer}
    >
      <form onSubmit={canEditEvent ? handleSubmit : (e) => e.preventDefault()}>
        <div className="flex items-start gap-3">
          <span className="mt-2.5 h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: eventColor }} />
          <textarea
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Event title"
            autoFocus={!isEditing}
            rows={1}
            disabled={!canEditEvent}
            className="block w-full resize-none border-0 bg-transparent p-0 font-serif text-[1.75rem] leading-9 text-heading outline-none [field-sizing:content] placeholder:text-placeholder"
          />
        </div>

        {isEditing && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-4">
            <span className={cn("badge", statusPreviewMeta.className)}>{statusPreviewMeta.label}</span>
            {eventStatus !== statusPreviewValue && (
              <span className="text-xs text-muted">saved as {eventStatus.replace("_", " ")}</span>
            )}
            {canMarkDone && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleMarkDone}
                isLoading={markingDone}
                disabled={isLoading}
                leftIcon={<Check />}
                className="ml-auto"
              >
                {event?._isRecurrenceInstance ? "Mark occurrence done" : "Mark done"}
              </Button>
            )}
          </div>
        )}

        <dl className="mt-6 grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1.5 border-y border-border py-3">
          <Property icon={Sun} label="All day">
            <Toggle checked={allDay} onChange={(next) => setAllDay(next)} disabled={!canEditEvent} size="sm" />
          </Property>

          {allDay ? (
            <>
              <Property icon={CalendarDays} label="Starts">
                <input type="date" aria-label="Start date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEditEvent} className={cn("input-base", subtleField)} />
              </Property>
              <Property icon={CalendarDays} label="Ends">
                <input type="date" aria-label="End date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canEditEvent} className={cn("input-base", subtleField)} />
              </Property>
            </>
          ) : (
            <>
              <Property icon={Clock3} label="Starts">
                <input
                  type="datetime-local"
                  aria-label="Start"
                  value={startTime}
                  onChange={(e) => {
                    if (!canEditEvent) return;
                    setStartTime(e.target.value);
                    const newStart = new Date(e.target.value);
                    const currentEnd = new Date(endTime);
                    if (currentEnd <= newStart) {
                      const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
                      setEndTime(`${newEnd.getFullYear()}-${String(newEnd.getMonth()+1).padStart(2,'0')}-${String(newEnd.getDate()).padStart(2,'0')}T${String(newEnd.getHours()).padStart(2,'0')}:${String(newEnd.getMinutes()).padStart(2,'0')}`);
                    }
                  }}
                  disabled={!canEditEvent}
                  className={cn("input-base font-mono", subtleField)}
                />
              </Property>
              <Property icon={Clock3} label="Ends">
                <input type="datetime-local" aria-label="End" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canEditEvent} className={cn("input-base font-mono", subtleField)} />
              </Property>
            </>
          )}

          <Property icon={Repeat2} label="Repeat">
            <Select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value)} options={RECURRENCE_OPTIONS} disabled={!canEditEvent} className={subtleField} aria-label="Repeat" />
          </Property>

          {recurrenceRule === "custom" && (
            <Property icon={CalendarDays} label="On">
              <div className="flex gap-1 px-1 py-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleCustomDay(day.key)}
                    disabled={!canEditEvent}
                    aria-pressed={customDays.has(day.key)}
                    aria-label={day.key}
                    className={cn(
                      "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full font-mono text-[0.6875rem] transition-colors",
                      customDays.has(day.key) ? "bg-heading text-surface" : "bg-surface-tertiary text-muted hover:text-heading"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </Property>
          )}

          <Property icon={CalendarRange} label="Calendar">
            <Select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} options={calendarOptions} disabled={!canEditEvent} className={subtleField} aria-label="Calendar" />
          </Property>

          <Property icon={FolderKanban} label="Project">
            <Select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setLinkedTasks([]);
              }}
              options={projectOptions}
              disabled={!canEditEvent}
              className={subtleField}
              aria-label="Project"
            />
          </Property>

          <Property icon={CircleDot} label="Status">
            <Select value={eventStatus} onChange={(e) => setEventStatus(e.target.value)} options={EVENT_STATUS_OPTIONS} disabled={!canEditEvent} className={subtleField} aria-label="Status" />
          </Property>

          <Property icon={Shapes} label="Type">
            <Select
              value={eventType}
              onChange={(e) => {
                const nextType = e.target.value;
                setEventType(nextType);
                if (nextType === "focus" && eventColor === DEFAULT_EVENT_COLOR) setEventColor(FOCUS_BLOCK_COLOR);
              }}
              options={EVENT_TYPE_OPTIONS}
              disabled={!canEditEvent}
              className={subtleField}
              aria-label="Type"
            />
          </Property>

          <Property icon={Palette} label="Colour">
            <div className="flex flex-wrap items-center gap-1.5 px-1 py-1.5" role="radiogroup" aria-label="Event colour">
              {EVENT_COLOR_OPTIONS.map((color) => {
                const active = eventColor === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setEventColor(color.value)}
                    disabled={!canEditEvent}
                    title={color.name}
                    aria-label={color.name}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform",
                      canEditEvent && "cursor-pointer hover:scale-110",
                      active && "ring-2 ring-heading ring-offset-2 ring-offset-surface"
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                );
              })}
              <span className="ml-1 text-xs text-muted" aria-live="polite">{selectedColorName}</span>
            </div>
          </Property>
        </dl>

        <div className="mt-6 space-y-5">
          <SearchableSelect
            label="Linked tasks"
            placeholder="Search tasks to link"
            value={linkedTasks}
            onSearch={handleTaskSearch}
            onSelect={(item) => setLinkedTasks((prev) => [...prev, item])}
            onRemove={(item) => setLinkedTasks((prev) => prev.filter((t) => t.id !== item.id))}
            renderChip={renderTaskChip}
            renderItem={renderTaskItem}
            disabled={!canEditEvent}
            multi
          />
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add a place or link" leftIcon={<MapPin />} disabled={!canEditEvent} />
          <Textarea label="Notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Agenda, links, context" disabled={!canEditEvent} />
        </div>
      </form>
    </Modal>
  );
}
