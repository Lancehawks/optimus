"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/components/ui";
import { Spinner } from "@/components/ui";
import {
  useCalendars,
  useCalendarMutations,
  useEvents,
  useEventMutations,
} from "@/hooks/useCalendar";
import {
  getVisibleRange,
  navigatePrev,
  navigateNext,
} from "@/lib/calendarUtils";

import CalendarHeader from "@/components/calendar/CalendarHeader";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import EventModal from "@/components/calendar/EventModal";
import CalendarManagerModal from "@/components/calendar/CalendarManagerModal";

export default function CalendarPage() {
  const { addToast } = useToast();

  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");

  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [defaultStartTime, setDefaultStartTime] = useState(null);
  const [showCalendarManager, setShowCalendarManager] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Calendar visibility
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(null);

  // Swipe detection
  const touchStartRef = useRef(null);
  const calendarAreaRef = useRef(null);

  // Data hooks
  const { calendars, isLoading: calendarsLoading, refetch: refetchCalendars } = useCalendars();

  const effectiveSelectedIds = useMemo(() => {
    if (selectedCalendarIds !== null) return selectedCalendarIds;
    return new Set(calendars.map((c) => c.id));
  }, [calendars, selectedCalendarIds]);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getVisibleRange(currentDate, viewMode),
    [currentDate, viewMode]
  );

  const { events, isLoading: eventsLoading, refetch: refetchEvents } = useEvents(
    rangeStart,
    rangeEnd,
    effectiveSelectedIds
  );

  const refetchAll = useCallback(() => {
    refetchEvents();
  }, [refetchEvents]);

  const { createEvent, updateEvent, deleteEvent, isLoading: eventMutLoading } =
    useEventMutations(refetchAll);

  const {
    createCalendar,
    updateCalendar,
    deleteCalendar,
    isLoading: calMutLoading,
  } = useCalendarMutations(() => {
    refetchCalendars();
    refetchEvents();
  });

  const defaultCalendarId = useMemo(() => {
    const def = calendars.find((c) => c.is_default);
    return def?.id || calendars[0]?.id || "";
  }, [calendars]);

  // Navigation handlers
  function handlePrev() {
    setCurrentDate(navigatePrev(currentDate, viewMode));
  }

  function handleNext() {
    setCurrentDate(navigateNext(currentDate, viewMode));
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  // Swipe handlers for touch navigation
  function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(e) {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Only trigger if horizontal swipe is dominant and > 60px
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartRef.current = null;
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      // Don't navigate when modal is open or typing in an input
      if (showEventModal || showCalendarManager) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "t" || e.key === "T") {
        handleToday();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentDate, viewMode, showEventModal, showCalendarManager]);

  // New Event button handler
  function handleNewEvent() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    setDefaultStartTime(now);
    setEditingEvent(null);
    setShowEventModal(true);
  }

  // Event handlers
  function handleDateClick(date) {
    if (viewMode === "month") {
      const start = new Date(date);
      start.setHours(9, 0, 0, 0);
      setDefaultStartTime(start);
      setEditingEvent(null);
      setShowEventModal(true);
    }
  }

  function handleTimeSlotClick(dateTime) {
    setDefaultStartTime(dateTime);
    setEditingEvent(null);
    setShowEventModal(true);
  }

  function handleEventClick(event) {
    setEditingEvent(event);
    setDefaultStartTime(null);
    setShowEventModal(true);
  }

  async function handleEventSave(data, existingId) {
    try {
      if (existingId) {
        await updateEvent(existingId, data);
        addToast({ message: "Event updated", type: "success" });
      } else {
        await createEvent(data);
        addToast({ message: "Event created", type: "success" });
      }
      setShowEventModal(false);
      setEditingEvent(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }

  async function handleEventDelete(id) {
    try {
      await deleteEvent(id);
      addToast({ message: "Event deleted", type: "success" });
      setShowEventModal(false);
      setEditingEvent(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }

  function handleToggleCalendar(calendarId) {
    setSelectedCalendarIds((prev) => {
      const next = new Set(prev || calendars.map((c) => c.id));
      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }
      return next;
    });
  }

  function handleDateSelect(date) {
    setCurrentDate(date);
  }

  const isLoading = calendarsLoading || eventsLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewChange={setViewMode}
        onToday={handleToday}
        onPrev={handlePrev}
        onNext={handleNext}
        onNewEvent={handleNewEvent}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        isSidebarOpen={sidebarOpen}
      />

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <CalendarSidebar
          currentDate={currentDate}
          onDateSelect={handleDateSelect}
          calendars={calendars}
          selectedCalendarIds={effectiveSelectedIds}
          onToggleCalendar={handleToggleCalendar}
          onManageCalendars={() => setShowCalendarManager(true)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Calendar view with swipe support */}
        <div
          ref={calendarAreaRef}
          className="flex-1 min-w-0 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {isLoading && events.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {viewMode === "month" && (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onDateClick={handleDateClick}
                  onEventClick={handleEventClick}
                />
              )}
              {viewMode === "week" && (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                />
              )}
              {viewMode === "day" && (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        calendars={calendars}
        defaultCalendarId={defaultCalendarId}
        defaultStartTime={defaultStartTime}
        onSave={handleEventSave}
        onDelete={handleEventDelete}
        isLoading={eventMutLoading}
      />

      {/* Calendar Manager Modal */}
      <CalendarManagerModal
        isOpen={showCalendarManager}
        onClose={() => setShowCalendarManager(false)}
        calendars={calendars}
        onCreate={createCalendar}
        onUpdate={updateCalendar}
        onDelete={deleteCalendar}
        isLoading={calMutLoading}
      />
    </div>
  );
}
