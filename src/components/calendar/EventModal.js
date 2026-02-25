"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/calendarUtils";
import { useToast } from "@/components/ui";
import { Modal, Button, Input, Textarea, Select } from "@/components/ui";

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

function toLocalDatetime(date) {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toLocalDate(date) {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
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
    } else {
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(false);
      setCalendarId(defaultCalendarId || "");
      setRecurrenceRule("");
      setCustomDays(new Set());

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
        ? new Date(`${startDate}T00:00:00`).toISOString()
        : new Date(startTime).toISOString(),
      end_time: allDay
        ? new Date(`${endDate}T23:59:59`).toISOString()
        : new Date(endTime).toISOString(),
      calendar_id: calendarId || undefined,
      recurrence_rule: rule,
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
    label: c.name,
  }));

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
