"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ErrorState, Spinner, useToast } from "@/components/ui";
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
import CalendarManagerModal from "@/components/calendar/CalendarManagerModal";
import TimeBlockingPanel from "@/components/calendar/TimeBlockingPanel";
import { useGoogleConnection } from "@/hooks/useGoogleCalendar";
import { FOCUS_BLOCK_COLOR } from "@/lib/eventDisplay";

const EventModal = dynamic(() => import("@/components/calendar/EventModal"), { ssr: false });

export default function CalendarPage() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const {
    status: googleStatus,
    isLoading: googleLoading,
    isSyncing,
    sync: googleSync,
    connect: googleConnect,
    disconnect: googleDisconnect,
  } = useGoogleConnection();

  // View state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");

  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [defaultStartTime, setDefaultStartTime] = useState(null);
  const [defaultEventDraft, setDefaultEventDraft] = useState(null);
  const [showCalendarManager, setShowCalendarManager] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Calendar visibility
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(null);

  // Swipe detection
  const touchStartRef = useRef(null);
  const calendarAreaRef = useRef(null);

  // Data hooks
  const { calendars, error: calendarsError, isLoading: calendarsLoading, refetch: refetchCalendars } = useCalendars();

  const effectiveSelectedIds = useMemo(() => {
    if (selectedCalendarIds !== null) return selectedCalendarIds;
    return new Set(calendars.map((c) => c.id));
  }, [calendars, selectedCalendarIds]);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getVisibleRange(currentDate, viewMode),
    [currentDate, viewMode]
  );

  const { events, error: eventsError, isLoading: eventsLoading, refetch: refetchEvents } = useEvents(
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
  const handlePrev = useCallback(() => {
    setCurrentDate((date) => navigatePrev(date, viewMode));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate((date) => navigateNext(date, viewMode));
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

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
  }, [handleNext, handlePrev, handleToday, showEventModal, showCalendarManager]);

  // Handle Google OAuth redirect
  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") {
      addToast({ message: "Google Calendar connected. Initial import is running in the background.", type: "success" });
      window.history.replaceState({}, "", "/calendar");
    } else if (googleParam === "error") {
      const message = searchParams.get("message") || "Failed to connect Google";
      addToast({ message: `Google error: ${message}`, type: "error" });
      window.history.replaceState({}, "", "/calendar");
    }
  }, [addToast, searchParams]);

  // Auto-sync Google Calendar once on page load
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (googleStatus.connected && !googleLoading && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      googleSync()
        .then(() => {
          refetchCalendars();
          refetchEvents();
        })
        .catch(() => {});
    }
  }, [googleStatus.connected, googleLoading, googleSync, refetchCalendars, refetchEvents]);

  // New Event button handler
  function handleNewEvent() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    setDefaultStartTime(now);
    setDefaultEventDraft(null);
    setEditingEvent(null);
    setShowEventModal(true);
  }

  // Event handlers
  function handleDateClick(date) {
    if (viewMode === "month") {
      setCurrentDate(date);
      setViewMode("day");
    }
  }

  function handleTimeSlotClick(dateTime) {
    setDefaultStartTime(dateTime);
    setDefaultEventDraft(null);
    setEditingEvent(null);
    setShowEventModal(true);
  }

  function handleEventClick(event) {
    setEditingEvent(event);
    setDefaultStartTime(null);
    setDefaultEventDraft(null);
    setShowEventModal(true);
  }

  function handleCreateFocusBlock(startTime) {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setDefaultStartTime(start);
    setDefaultEventDraft({
      title: "Focus block",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      event_color: FOCUS_BLOCK_COLOR,
      status: "scheduled",
      event_type: "focus",
    });
    setEditingEvent(null);
    setShowEventModal(true);
  }

  async function handleScheduleTask(task, startTime) {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      const result = await createEvent({
        title: `Focus: ${task.title}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        calendar_id: defaultCalendarId || undefined,
        projectId: task.project_id || null,
        task_ids: [task.id],
        event_color: FOCUS_BLOCK_COLOR,
        status: "scheduled",
        event_type: "focus",
      });
      addToast({ message: "Task scheduled", type: "success" });
      if (result?.googleError) {
        addToast({ message: `Google sync failed: ${result.googleError}`, type: "error" });
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }

  async function handleEventSave(data, existingId) {
    try {
      let result;
      if (existingId) {
        result = await updateEvent(existingId, data);
        addToast({ message: "Event updated", type: "success" });
      } else {
        result = await createEvent(data);
        addToast({ message: "Event created", type: "success" });
      }
      if (result?.googleError) {
        addToast({ message: `Google sync failed: ${result.googleError}`, type: "error" });
      }
      setShowEventModal(false);
      setEditingEvent(null);
      setDefaultEventDraft(null);
      setDefaultStartTime(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }

  async function handleEventMarkDone(event) {
    if (!event) return false;
    try {
      const result = await updateEvent(event.id, { status: "done" });
      addToast({ message: "Event marked done", type: "success" });
      if (result?.googleError) {
        addToast({ message: `Google sync failed: ${result.googleError}`, type: "error" });
      }
      setShowEventModal(false);
      setEditingEvent(null);
      setDefaultEventDraft(null);
      setDefaultStartTime(null);
      return true;
    } catch (error) {
      addToast({ message: error.message, type: "error" });
      return false;
    }
  }

  async function handleEventDelete(id) {
    try {
      await deleteEvent(id);
      addToast({ message: "Event deleted", type: "success" });
      setShowEventModal(false);
      setEditingEvent(null);
      setDefaultEventDraft(null);
      setDefaultStartTime(null);
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

  async function handleGoogleSync() {
    try {
      await googleSync();
      addToast({ message: "Google Calendar sync queued. New events will appear shortly.", type: "success" });
    } catch (error) {
      addToast({ message: error.message || "Sync failed", type: "error" });
    }
  }

  async function handleGoogleDisconnect() {
    try {
      await googleDisconnect();
      refetchCalendars();
      refetchEvents();
      addToast({ message: "Google Calendar disconnected", type: "success" });
      setShowCalendarManager(false);
    } catch (error) {
      addToast({ message: error.message || "Disconnect failed", type: "error" });
    }
  }

  const isLoading = calendarsLoading || eventsLoading;

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col lg:h-[calc(100vh-64px)]">
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

      {(calendarsError || eventsError) && (
        <ErrorState
          compact
          className="shrink-0"
          title="Calendar data could not be loaded"
          description="No empty calendar state was substituted. Retry the failed request."
          onRetry={() => {
            void refetchCalendars();
            void refetchEvents();
          }}
        />
      )}

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
          googleConnected={googleStatus.connected}
          googleLoading={googleLoading}
          onGoogleSync={handleGoogleSync}
          onGoogleConnect={googleConnect}
          isSyncing={isSyncing}
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
                  onTaskDrop={handleScheduleTask}
                />
              )}
              {viewMode === "day" && (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onTimeSlotClick={handleTimeSlotClick}
                  onEventClick={handleEventClick}
                  onTaskDrop={handleScheduleTask}
                />
              )}
            </>
          )}
        </div>

        <TimeBlockingPanel
          currentDate={currentDate}
          events={events}
          onScheduleTask={handleScheduleTask}
          onCreateFocusBlock={handleCreateFocusBlock}
        />
      </div>

      {/* Event Modal */}
      {showEventModal && <EventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEditingEvent(null);
          setDefaultEventDraft(null);
        }}
        event={editingEvent}
        calendars={calendars}
        defaultCalendarId={defaultCalendarId}
        defaultStartTime={defaultStartTime}
        defaultDraft={defaultEventDraft}
        onSave={handleEventSave}
        onMarkDone={handleEventMarkDone}
        onDelete={handleEventDelete}
        isLoading={eventMutLoading}
      />}

      {/* Calendar Manager Modal */}
      <CalendarManagerModal
        isOpen={showCalendarManager}
        onClose={() => setShowCalendarManager(false)}
        calendars={calendars}
        onCreate={createCalendar}
        onUpdate={updateCalendar}
        onDelete={deleteCalendar}
        isLoading={calMutLoading}
        googleConnected={googleStatus.connected}
        onGoogleConnect={googleConnect}
        onGoogleDisconnect={handleGoogleDisconnect}
      />
    </div>
  );
}
