"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { calendarService, eventService } from "@/services/api";

const NO_CALENDARS = [];
const NO_EVENTS = [];

// ── Calendars ────────────────────────────────────────

async function loadCalendars() {
  const data = await calendarService.list();
  if (data.calendars.length > 0) return data.calendars;

  // Auto-create default calendar if none exist
  const result = await calendarService.create({
    name: "My Calendar",
    color: "#0d6b88",
  });
  return [result.calendar];
}

export function useCalendars() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["calendars"],
    queryFn: loadCalendars,
  });

  return { calendars: data ?? NO_CALENDARS, error, isLoading, refetch };
}

export function useCalendarMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createCalendar = async (data) => {
    setIsLoading(true);
    try {
      const result = await calendarService.create(data);
      onSuccess?.();
      return result.calendar;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCalendar = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await calendarService.update(id, data);
      onSuccess?.();
      return result.calendar;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCalendar = async (id) => {
    setIsLoading(true);
    try {
      await calendarService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return { createCalendar, updateCalendar, deleteCalendar, isLoading };
}

// ── Events ───────────────────────────────────────────

export function useEvents(rangeStart, rangeEnd, calendarIds) {
  const start = rangeStart ? rangeStart.toISOString() : null;
  const end = rangeEnd ? rangeEnd.toISOString() : null;
  const calendarIdKey = calendarIds ? [...calendarIds].sort().join(",") : "";

  // Cached per range; showing or hiding calendars filters without a refetch.
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["events", "range", start, end],
    queryFn: async () => (await eventService.list({ start, end })).events,
    enabled: Boolean(start && end),
  });

  const events = useMemo(() => {
    if (!data) return NO_EVENTS;
    const selectedIds = calendarIdKey ? new Set(calendarIdKey.split(",")) : null;
    if (!selectedIds || selectedIds.size === 0) return data;
    return data.filter((e) => e.project_id || selectedIds.has(e.calendar_id));
  }, [data, calendarIdKey]);

  return { events, error, isLoading, refetch };
}

export function useEventMutations(onSuccess) {
  const [isLoading, setIsLoading] = useState(false);

  const createEvent = async (data) => {
    setIsLoading(true);
    try {
      const result = await eventService.create(data);
      onSuccess?.();
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const updateEvent = async (id, data) => {
    setIsLoading(true);
    try {
      const result = await eventService.update(id, data);
      onSuccess?.();
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEvent = async (id) => {
    setIsLoading(true);
    try {
      await eventService.delete(id);
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return { createEvent, updateEvent, deleteEvent, isLoading };
}
