"use client";

import { useState, useEffect, useCallback } from "react";
import { calendarService, eventService } from "@/services/api";

// ── Calendars ────────────────────────────────────────

export function useCalendars() {
  const [calendars, setCalendars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCalendars = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await calendarService.list();
      let cals = data.calendars;

      // Auto-create default calendar if none exist
      if (cals.length === 0) {
        const result = await calendarService.create({
          name: "My Calendar",
          color: "#0d6b88",
        });
        cals = [result.calendar];
      }

      setCalendars(cals);
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  return { calendars, isLoading, refetch: fetchCalendars };
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
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const rangeStartTime = rangeStart?.getTime() ?? null;
  const rangeEndTime = rangeEnd?.getTime() ?? null;
  const calendarIdKey = calendarIds ? [...calendarIds].sort().join(",") : "";

  const fetchEvents = useCallback(async () => {
    if (rangeStartTime === null || rangeEndTime === null) return;

    setIsLoading(true);
    try {
      const params = {
        start: new Date(rangeStartTime).toISOString(),
        end: new Date(rangeEndTime).toISOString(),
      };

      const data = await eventService.list(params);

      // Filter by selected calendars on the client side
      let filtered = data.events;
      const selectedIds = calendarIdKey ? new Set(calendarIdKey.split(",")) : null;
      if (selectedIds && selectedIds.size > 0) {
        filtered = filtered.filter((e) => e.project_id || selectedIds.has(e.calendar_id));
      }

      setEvents(filtered);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [rangeStartTime, rangeEndTime, calendarIdKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, refetch: fetchEvents };
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
