"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import { Button, Input, Modal, SearchableSelect, Select, Textarea, useToast } from "@/components/ui";
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

const STATUS_STYLES = {
  done: "bg-green-500/20 text-green-400",
  in_progress: "bg-blue-500/20 text-blue-400",
};

const PRIORITY_COLORS = {
  urgent: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
};

function toLocalDatetime(date) {
  if (!date) return "";
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

function toLocalDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

// Parse a datetime-local string as local time, avoiding new Date(string) ambiguity
function localDatetimeToISO(str) {
  const [datePart, timePart] = str.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).toISOString();
}

function localDateToISO(str, hours = 0, minutes = 0, seconds = 0) {
  const [y, mo, d] = str.split("-").map(Number);
  return new Date(y, mo - 1, d, hours, minutes, seconds).toISOString();
}

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

function formatDateLong(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function sameLocalDate(a, b) {
  if (!a || !b) return false;
  return toLocalDate(a) === toLocalDate(b);
}

function formatEventTimeRange(event) {
  if (!event?.start_time || !event?.end_time) return "";

  if (event.all_day) {
    return sameLocalDate(event.start_time, event.end_time)
      ? `${formatDateLong(event.start_time)}, all day`
      : `${formatDateLong(event.start_time)} to ${formatDateLong(event.end_time)}, all day`;
  }

  return sameLocalDate(event.start_time, event.end_time)
    ? `${formatDateLong(event.start_time)}, ${formatTimeShort(event.start_time)} to ${formatTimeShort(event.end_time)}`
    : `${formatDateLong(event.start_time)} ${formatTimeShort(event.start_time)} - ${formatDateLong(event.end_time)} ${formatTimeShort(event.end_time)}`;
}

function formatRecurrence(rule) {
  if (!rule) return "Does not repeat";
  if (rule.startsWith("custom:")) {
    const days = rule.slice(7).split(",").filter(Boolean).join(", ");
    return days ? `Custom: ${days}` : "Custom";
  }
  return rule.charAt(0).toUpperCase() + rule.slice(1);
}

function DetailRow({ icon, label, children }) {
  if (!children) return null;

  return (
    <div className="flex gap-3 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-caption uppercase text-muted">{label}</p>
        <div className="mt-1 text-body-sm text-heading!">{children}</div>
      </div>
    </div>
  );
}

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
      setStartTime(toLocalDatetime(event.start_time));
      setEndTime(toLocalDatetime(event.end_time));
      setStartDate(toLocalDate(event.start_time));
      setEndDate(toLocalDate(event.end_time));
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
        setStartTime(toLocalDatetime(start));
        setEndTime(toLocalDatetime(end));
        setStartDate(toLocalDate(start));
        setEndDate(toLocalDate(start));
      } else if (defaultStartTime) {
        const start = new Date(defaultStartTime);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
        setStartTime(toLocalDatetime(start));
        setEndTime(toLocalDatetime(end));
        setStartDate(toLocalDate(start));
        setEndDate(toLocalDate(start));
      } else {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        const end = new Date(now.getTime() + 60 * 60 * 1000);
        setStartTime(toLocalDatetime(now));
        setEndTime(toLocalDatetime(end));
        setStartDate(toLocalDate(now));
        setEndDate(toLocalDate(now));
      }
    }
  }, [event, isOpen, defaultCalendarId, defaultStartTime, defaultDraft]);

  // Task search handler for SearchableSelect
  const handleTaskSearch = useCallback(async (query) => {
    const params = { limit: 10 };
    if (query.trim()) params.search = query;
    if (projectId) params.project_id = projectId;
    const res = await taskService.list(params);
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

    const data = {
      title: title.trim(),
      description: description || null,
      location: location || null,
      all_day: allDay,
      start_time: allDay
        ? localDateToISO(startDate, 0, 0, 0)
        : localDatetimeToISO(startTime),
      end_time: allDay
        ? localDateToISO(endDate, 23, 59, 59)
        : localDatetimeToISO(endTime),
      calendar_id: calendarId || undefined,
      projectId: projectId || null,
      recurrence_rule: rule,
      task_ids: linkedTasks.map((t) => t.id),
      event_color: eventColor,
      status: eventStatus,
      event_type: eventType,
    };

    await onSave?.(data, isEditing ? (event._masterEventId || event.id) : null);
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
  const canDeleteEvent = isEditing && (event?.user_id === user?.id || event?.is_project_owner);
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
  const canMarkDone = isEditing && canEditEvent && eventStatus !== "done";

  // Custom renderers for task chips and dropdown items
  function renderTaskChip(item) {
    return (
      <span
        key={item.id}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-brand-500/15 text-brand-400 border border-brand-500/20"
      >
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="truncate max-w-[180px]">{item.label}</span>
        {item.status && (
          <span className={cn(
            "text-[9px] px-1 py-0.5 rounded-sm uppercase tracking-wider",
            STATUS_STYLES[item.status] || "bg-neutral-500/20 text-neutral-400"
          )}>
            {item.status.replace("_", " ")}
          </span>
        )}
        {canEditEvent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLinkedTasks((prev) => prev.filter((t) => t.id !== item.id));
            }}
            className="text-brand-400/60 hover:text-brand-400 cursor-pointer ml-0.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
          if (canEditEvent) {
            setLinkedTasks((prev) => [...prev, item]);
          }
        }}
        disabled={!canEditEvent}
        className={cn(
          "w-full text-left px-3 py-2 text-body-sm transition-colors flex items-center gap-2 cursor-pointer",
          isHighlighted ? "bg-surface-tertiary" : "hover:bg-surface-tertiary"
        )}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          PRIORITY_COLORS[item.priority] || "bg-neutral-400"
        )} />
        <span className="truncate flex-1">{item.label}</span>
        <span className="text-caption text-muted shrink-0">{item.sublabel}</span>
      </button>
    );
  }

  if (isEditing && !canEditEvent) {
    const viewerTasks = (event.linked_tasks || []).map(taskToSelectItem);
    const calendarName = event.calendar_name || calendars.find((c) => c.id === event.calendar_id)?.name;
    const calendarColor = event.calendar_color || calendars.find((c) => c.id === event.calendar_id)?.color || "#6366f1";
    const projectName = event.project_name || projects.find((project) => project.id === event.project_id)?.name;
    const projectColor = event.project_color || projects.find((project) => project.id === event.project_id)?.color || "#6366f1";
    const displayColor = getEventDisplayColor(event, event.project_id ? projectColor : calendarColor);
    const statusMeta = getEventStatusMeta(event);

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Event Details"
        size="lg"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: displayColor }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-caption text-muted mb-1">View only</p>
                  <h3 className="text-h3 text-heading! break-words">{event.title || "Untitled event"}</h3>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-caption font-medium", statusMeta.className)}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {projectName && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium"
                    style={{ backgroundColor: `${projectColor}20`, color: projectColor }}
                  >
                    {projectName}
                  </span>
                )}
                {calendarName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-2.5 py-1 text-caption text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: displayColor }} />
                    {calendarName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-border-light">
            <DetailRow
              label="Status"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            >
              <span className={cn("inline-flex rounded-full px-2.5 py-1 text-caption font-medium", statusMeta.className)}>
                {statusMeta.label}
              </span>
            </DetailRow>

            <DetailRow
              label="Time"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              {formatEventTimeRange(event)}
            </DetailRow>

            <DetailRow
              label="Location"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              }
            >
              {event.location}
            </DetailRow>

            <DetailRow
              label="Linked tasks"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              {viewerTasks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewerTasks.map((task) => (
                    <span
                      key={task.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/15 px-2.5 py-1 text-[11px] font-medium text-brand-400"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_COLORS[task.priority] || "bg-neutral-400")} />
                      {task.label}
                      {task.status && (
                        <span className={cn("rounded-sm px-1 py-0.5 text-[9px] uppercase", STATUS_STYLES[task.status] || "bg-neutral-500/20 text-neutral-400")}>
                          {task.status.replace("_", " ")}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </DetailRow>

            <DetailRow
              label="Repeat"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M4.031 9.865H2.985" />
                </svg>
              }
            >
              {formatRecurrence(event.recurrence_rule)}
            </DetailRow>

            <DetailRow
              label="Description"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5A3.375 3.375 0 0010.125 2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25v-5.25z" />
                </svg>
              }
            >
              {event.description && <p className="whitespace-pre-wrap text-muted">{event.description}</p>}
            </DetailRow>
          </div>
        </div>
      </Modal>
    );
  }

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div>
        {canDeleteEvent && (
          <Button variant="danger" size="sm" onClick={handleDelete}>
            {event?._isRecurrenceInstance ? "Delete series" : "Delete"}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onClose}>
          {canEditEvent ? "Cancel" : "Close"}
        </Button>
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
      title={isEditing && !canEditEvent ? "View Event" : isEditing ? "Edit Event" : "New Event"}
      size="lg"
      footer={footer}
    >
      <form onSubmit={canEditEvent ? handleSubmit : (e) => e.preventDefault()} className="space-y-4">
        {isEditing && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-secondary p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                statusPreviewValue === "done"
                  ? "bg-green-500/15 text-green-300"
                  : statusPreviewValue === "missed"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-surface-tertiary text-muted"
              )}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-caption uppercase text-muted">Event status</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-caption font-medium", statusPreviewMeta.className)}>
                    {statusPreviewMeta.label}
                  </span>
                  {eventStatus !== statusPreviewValue && (
                    <span className="text-caption text-muted">
                      saved as {eventStatus.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {canMarkDone && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleMarkDone}
                isLoading={markingDone}
                disabled={isLoading}
                className="w-full border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/15 sm:w-auto"
              >
                {event?._isRecurrenceInstance ? "Mark occurrence done" : "Mark done"}
              </Button>
            )}
          </div>
        )}

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          autoFocus
          disabled={!canEditEvent}
        />

        {/* All-day toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAllDay(!allDay)}
            disabled={!canEditEvent}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer",
              allDay ? "bg-brand-500" : "bg-neutral-600",
              !canEditEvent && "cursor-not-allowed opacity-70"
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                allDay ? "translate-x-4.5" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="text-body-sm">All day</span>
        </div>

        {/* Date/Time fields */}
        {allDay ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-body-sm text-heading! font-medium block mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEditEvent}
                className="input-base w-full scheme-dark"
              />
            </div>
            <div>
              <label className="text-body-sm text-heading! font-medium block mb-1.5">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!canEditEvent}
                className="input-base w-full scheme-dark"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-body-sm text-heading! font-medium block mb-1.5">
                Start
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                  if (!canEditEvent) return;
                  setStartTime(e.target.value);
                  // Auto-set end to start + 1 hour if end is before new start
                  const newStart = new Date(e.target.value);
                  const currentEnd = new Date(endTime);
                  if (currentEnd <= newStart) {
                    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
                    setEndTime(toLocalDatetime(newEnd));
                  }
                }}
                disabled={!canEditEvent}
                className="input-base w-full scheme-dark"
              />
            </div>
            <div>
              <label className="text-body-sm text-heading! font-medium block mb-1.5">
                End
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!canEditEvent}
                className="input-base w-full scheme-dark"
              />
            </div>
          </div>
        )}

        {/* Calendar selector */}
        <Select
          label="Calendar"
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          options={calendarOptions}
          disabled={!canEditEvent}
        />

        <Select
          label="Project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setLinkedTasks([]);
          }}
          options={projectOptions}
          disabled={!canEditEvent}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Status"
            value={eventStatus}
            onChange={(e) => setEventStatus(e.target.value)}
            options={EVENT_STATUS_OPTIONS}
            disabled={!canEditEvent}
          />
          <Select
            label="Type"
            value={eventType}
            onChange={(e) => {
              const nextType = e.target.value;
              setEventType(nextType);
              if (nextType === "focus" && eventColor === DEFAULT_EVENT_COLOR) {
                setEventColor(FOCUS_BLOCK_COLOR);
              }
            }}
            options={EVENT_TYPE_OPTIONS}
            disabled={!canEditEvent}
          />
        </div>

        <div>
          <label className="text-body-sm text-heading! font-medium block mb-2">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {EVENT_COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setEventColor(color.value)}
                disabled={!canEditEvent}
                title={color.name}
                aria-label={color.name}
                className={cn(
                  "h-8 w-8 rounded-lg border border-border transition-transform",
                  canEditEvent && "cursor-pointer hover:scale-105",
                  eventColor === color.value && "ring-2 ring-white ring-offset-2 ring-offset-neutral-900"
                )}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>

        {/* Linked Tasks - searchable multi-select */}
        <SearchableSelect
          label="Linked tasks"
          placeholder="Search tasks to link..."
          value={linkedTasks}
          onSearch={handleTaskSearch}
          onSelect={(item) => setLinkedTasks((prev) => [...prev, item])}
          onRemove={(item) => setLinkedTasks((prev) => prev.filter((t) => t.id !== item.id))}
          renderChip={renderTaskChip}
          renderItem={renderTaskItem}
          disabled={!canEditEvent}
          multi
        />

        {/* Location */}
        <Input
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
          disabled={!canEditEvent}
        />

        {/* Description */}
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Add description"
          disabled={!canEditEvent}
        />

        {/* Recurrence */}
        <Select
          label="Repeat"
          value={recurrenceRule}
          onChange={(e) => setRecurrenceRule(e.target.value)}
          options={RECURRENCE_OPTIONS}
          disabled={!canEditEvent}
        />

        {/* Custom weekday picker */}
        {recurrenceRule === "custom" && (
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-2">
              Repeat on
            </label>
            <div className="flex gap-2">
              {WEEKDAYS.map((day, i) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => toggleCustomDay(day.key)}
                  disabled={!canEditEvent}
                  className={cn(
                    "w-8 h-8 rounded-full text-xs font-medium transition-colors cursor-pointer",
                    customDays.has(day.key)
                      ? "bg-brand-500 text-white"
                      : "bg-surface-tertiary text-muted hover:text-body"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
