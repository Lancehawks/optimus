"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import { useToast } from "@/components/ui";
import { Modal, Button, Input, Textarea, Select, SearchableSelect } from "@/components/ui";
import { taskService } from "@/services/api";

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

export default function EventModal({
  isOpen,
  onClose,
  event,
  calendars,
  defaultCalendarId,
  defaultStartTime,
  onSave,
  onDelete,
  isLoading,
}) {
  const isEditing = !!event;
  const { addToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [customDays, setCustomDays] = useState(new Set());
  const [linkedTasks, setLinkedTasks] = useState([]);

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
      setRecurrenceRule("");
      setCustomDays(new Set());
      setLinkedTasks([]);

      if (defaultStartTime) {
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
  }, [event, isOpen, defaultCalendarId, defaultStartTime]);

  // Task search handler for SearchableSelect
  const handleTaskSearch = useCallback(async (query) => {
    const params = { limit: 10 };
    if (query.trim()) params.search = query;
    const res = await taskService.list(params);
    return (res.tasks || []).filter((t) => t.status !== "done").map(taskToSelectItem);
  }, []);

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
      recurrence_rule: rule,
      task_ids: linkedTasks.map((t) => t.id),
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

  const calendarOptions = calendars.map((c) => ({
    value: c.id,
    label: c.is_google ? c.name : `${c.name} (local only)`,
  }));

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
      </span>
    );
  }

  function renderTaskItem(item, isHighlighted) {
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setLinkedTasks((prev) => [...prev, item]);
        }}
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

  const footer = (
    <div className="flex items-center justify-between w-full">
      <div>
        {isEditing && (
          <Button variant="danger" size="sm" onClick={handleDelete}>
            {event?._isRecurrenceInstance ? "Delete series" : "Delete"}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isLoading}>
          {isEditing ? "Save changes" : "Create event"}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Event" : "New Event"}
      size="lg"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          autoFocus
        />

        {/* All-day toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAllDay(!allDay)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer",
              allDay ? "bg-brand-500" : "bg-neutral-600"
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
                  setStartTime(e.target.value);
                  // Auto-set end to start + 1 hour if end is before new start
                  const newStart = new Date(e.target.value);
                  const currentEnd = new Date(endTime);
                  if (currentEnd <= newStart) {
                    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
                    setEndTime(toLocalDatetime(newEnd));
                  }
                }}
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
        />

        {/* Linked Tasks — searchable multi-select */}
        <SearchableSelect
          label="Linked tasks"
          placeholder="Search tasks to link..."
          value={linkedTasks}
          onSearch={handleTaskSearch}
          onSelect={(item) => setLinkedTasks((prev) => [...prev, item])}
          onRemove={(item) => setLinkedTasks((prev) => prev.filter((t) => t.id !== item.id))}
          renderChip={renderTaskChip}
          renderItem={renderTaskItem}
          multi
        />

        {/* Location */}
        <Input
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
        />

        {/* Description */}
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Add description"
        />

        {/* Recurrence */}
        <Select
          label="Repeat"
          value={recurrenceRule}
          onChange={(e) => setRecurrenceRule(e.target.value)}
          options={RECURRENCE_OPTIONS}
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
