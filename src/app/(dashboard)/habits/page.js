"use client";

import { useState, useCallback, useEffect } from "react";
import { Button, SearchBox, Spinner, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui";
import { useHabits, useHabitMutations, useHabitStats } from "@/hooks/useHabits";
import { habitService } from "@/services/api";
import HabitCard from "@/components/habits/HabitCard";
import HabitModal from "@/components/habits/HabitModal";
import HabitCalendar from "@/components/habits/HabitCalendar";
import HabitStats from "@/components/habits/HabitStats";
import WeeklyGrid from "@/components/habits/WeeklyGrid";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Health", "Learning", "Work", "Personal", "Wellness", "Other"];

export default function HabitsPage() {
  const { addToast } = useToast();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [selectedHabitDetail, setSelectedHabitDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [view, setView] = useState("cards"); // "cards" | "week"
  const [showPaused, setShowPaused] = useState(false);

  const { habits, isLoading, refetch } = useHabits({
    search: search || undefined,
    category: activeCategory !== "All" ? activeCategory : undefined,
  });

  const { habits: pausedHabits, refetch: refetchPaused } = useHabits({ is_active: false });

  const { createHabit, updateHabit, deleteHabit, toggleLog, isLoading: mutationLoading } =
    useHabitMutations(refetch);

  const { stats, isLoading: statsLoading, refetch: refetchStats } = useHabitStats(selectedHabitId);

  // Today's progress
  const doneToday = habits.filter(
    (h) => h.completed_today === true || h.completed_today === "true"
  ).length;
  const progressPct = habits.length > 0 ? Math.round((doneToday / habits.length) * 100) : 0;
  const allDone = habits.length > 0 && doneToday === habits.length;

  const fetchHabitDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const data = await habitService.get(id);
      setSelectedHabitDetail(data);
    } catch (error) {
      console.error("Failed to fetch habit detail:", error);
      setSelectedHabitDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedHabitId) {
      fetchHabitDetail(selectedHabitId);
    } else {
      setSelectedHabitDetail(null);
    }
  }, [selectedHabitId, fetchHabitDetail]);

  const handleCardClick = (habit) => {
    setSelectedHabitId((prev) => (prev === habit.id ? null : habit.id));
  };

  const handleToggleToday = useCallback(
    async (habit) => {
      try {
        const isCompleted = habit.completed_today === true || habit.completed_today === "true";
        await toggleLog(habit.id, { completed: !isCompleted });
        addToast({ message: isCompleted ? "Marked incomplete" : "Marked complete!", type: "success" });
      } catch (error) {
        addToast({ message: "Failed to update habit", type: "error" });
      }
    },
    [toggleLog, addToast]
  );

  const handleToggleDate = useCallback(
    async (habitId, dateStr) => {
      try {
        const log = selectedHabitDetail?.logs?.find((l) => {
          const d = new Date(l.log_date);
          const y = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${mo}-${day}` === dateStr && l.completed;
        });
        await toggleLog(habitId, { date: dateStr, completed: !log });
        fetchHabitDetail(habitId);
        refetchStats();
        addToast({ message: "Log updated", type: "success" });
      } catch (error) {
        addToast({ message: "Failed to update log", type: "error" });
      }
    },
    [toggleLog, selectedHabitDetail, fetchHabitDetail, refetchStats, addToast]
  );

  const handleWeeklyToggle = useCallback(
    async (habit, dateStr) => {
      try {
        const completedSet = new Set(habit.last_7_dates || []);
        await toggleLog(habit.id, { date: dateStr, completed: !completedSet.has(dateStr) });
        addToast({ message: "Log updated", type: "success" });
      } catch (error) {
        addToast({ message: "Failed to update", type: "error" });
      }
    },
    [toggleLog, addToast]
  );

  const handleSave = useCallback(
    async (formData) => {
      try {
        if (formData === null && editingHabit) {
          await deleteHabit(editingHabit.id);
          addToast({ message: "Habit deleted", type: "success" });
          if (selectedHabitId === editingHabit.id) setSelectedHabitId(null);
        } else if (editingHabit) {
          await updateHabit(editingHabit.id, formData);
          addToast({ message: "Habit updated", type: "success" });
        } else {
          await createHabit(formData);
          addToast({ message: "Habit created", type: "success" });
        }
        setShowModal(false);
        setEditingHabit(null);
      } catch (error) {
        addToast({ message: error.message, type: "error" });
      }
    },
    [editingHabit, createHabit, updateHabit, deleteHabit, addToast, selectedHabitId]
  );

  const handleEdit = (habit) => {
    setEditingHabit(habit);
    setShowModal(true);
  };

  const handleTogglePause = useCallback(
    async (habit) => {
      try {
        await habitService.update(habit.id, { isActive: !habit.is_active });
        refetch();
        refetchPaused();
        addToast({
          message: habit.is_active ? "Habit paused" : "Habit resumed",
          type: "success",
        });
        // Deselect if the paused habit was selected
        if (selectedHabitId === habit.id) setSelectedHabitId(null);
      } catch (error) {
        addToast({ message: "Failed to update habit", type: "error" });
      }
    },
    [refetch, refetchPaused, addToast, selectedHabitId]
  );

  const selectedHabitColor =
    selectedHabitDetail?.habit?.color ||
    habits.find((h) => h.id === selectedHabitId)?.color ||
    pausedHabits.find((h) => h.id === selectedHabitId)?.color ||
    "#22c55e";

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] lg:h-screen">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-border shrink-0">
        {/* Row 1: Title + view toggle + new button */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-h1">Habits</h1>
          <div className="flex items-center gap-2">
            {/* View toggle — desktop only */}
            <div className="hidden sm:flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setView("cards")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-body-sm cursor-pointer transition-colors",
                  view === "cards"
                    ? "bg-surface shadow-sm text-heading"
                    : "text-muted hover:text-body"
                )}
              >
                Cards
              </button>
              <button
                onClick={() => setView("week")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-body-sm cursor-pointer transition-colors",
                  view === "week"
                    ? "bg-surface shadow-sm text-heading"
                    : "text-muted hover:text-body"
                )}
              >
                Week
              </button>
            </div>
            {/* New Habit button */}
            <Button
              onClick={() => { setEditingHabit(null); setShowModal(true); }}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              <span className="hidden sm:inline">New Habit</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Search + category chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <SearchBox
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search habits..."
            className="w-full sm:max-w-xs"
          />
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-caption whitespace-nowrap cursor-pointer transition-colors shrink-0",
                  activeCategory === cat
                    ? "bg-brand-500/15 text-brand-400"
                    : "text-muted hover:bg-surface-tertiary hover:text-body"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : habits.length === 0 && !search && activeCategory === "All" ? (
          <EmptyState
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
              </svg>
            }
            title="No habits yet"
            description="Create your first habit to start tracking"
            action={{ children: "New Habit", onClick: () => { setEditingHabit(null); setShowModal(true); } }}
          />
        ) : (
          <>
            {/* Today's progress bar */}
            {habits.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-body-sm text-muted">Today's progress</span>
                  <span
                    className="text-body-sm font-semibold"
                    style={{ color: allDone ? "#22c55e" : undefined }}
                  >
                    {allDone ? "All habits done for today!" : `${doneToday} / ${habits.length}`}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: allDone ? "#22c55e" : "#14b8a6",
                    }}
                  />
                </div>
              </div>
            )}

            {/* No results message */}
            {habits.length === 0 && (search || activeCategory !== "All") && (
              <p className="text-muted text-body-sm text-center py-8">
                No habits match your filters.
              </p>
            )}

            {/* Cards view — always on mobile, respect view state on sm+ */}
            {habits.length > 0 && (
              <div className={cn(view === "week" && "sm:hidden")}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {habits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      onClick={() => handleCardClick(habit)}
                      onToggleToday={() => handleToggleToday(habit)}
                      onEdit={handleEdit}
                      onPause={handleTogglePause}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Weekly grid — sm+ only, only in week view */}
            {view === "week" && habits.length > 0 && (
              <div className="hidden sm:block">
                <WeeklyGrid habits={habits} onToggle={handleWeeklyToggle} />
              </div>
            )}

            {/* Detail panel (calendar + stats) */}
            {selectedHabitId && (
              <div className="mt-6 card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-h3 text-heading!">
                    {selectedHabitDetail?.habit?.name || "Loading..."}
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedHabitDetail?.habit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(selectedHabitDetail.habit)}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                        Edit
                      </Button>
                    )}
                    <button
                      onClick={() => setSelectedHabitId(null)}
                      className="btn-ghost rounded-lg p-1.5 cursor-pointer"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {detailLoading || statsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <HabitCalendar
                      logs={selectedHabitDetail?.logs || []}
                      color={selectedHabitColor}
                      habitId={selectedHabitId}
                      onToggleDate={handleToggleDate}
                    />
                    <HabitStats stats={stats} color={selectedHabitColor} />
                  </div>
                )}
              </div>
            )}

            {/* Paused habits section */}
            {pausedHabits.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowPaused((p) => !p)}
                  className="flex items-center gap-2 text-muted hover:text-heading cursor-pointer text-body-sm mb-3 group"
                >
                  <svg
                    className={cn(
                      "h-4 w-4 transition-transform",
                      showPaused && "rotate-90"
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>Paused ({pausedHabits.length})</span>
                </button>

                {showPaused && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pausedHabits.map((habit) => (
                      <HabitCard
                        key={habit.id}
                        habit={habit}
                        onClick={() => handleCardClick(habit)}
                        onToggleToday={() => {}}
                        onEdit={handleEdit}
                        onPause={handleTogglePause}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <HabitModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingHabit(null); }}
        habit={editingHabit}
        onSave={handleSave}
        isLoading={mutationLoading}
      />
    </div>
  );
}
