"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";

const PRIORITY_DOT = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-400",
  low: "bg-neutral-500",
};

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-9 rounded-lg bg-neutral-700/50 animate-pulse"
        />
      ))}
    </div>
  );
}

export default function TodaysTasksWidget() {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const { tasks, isLoading, refetch } = useTasks({
    sort: "due_date",
    order: "asc",
  });
  const {
    updateTask,
    createTask,
    isLoading: isMutating,
  } = useTaskMutations(refetch);

  const [completingId, setCompletingId] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { overdue, dueToday } = useMemo(() => {
    const overdue = tasks.filter((t) => {
      const d = t.due_date?.split("T")[0];
      return d && d < today && t.status !== "done";
    });
    const dueToday = tasks.filter((t) => {
      const d = t.due_date?.split("T")[0];
      return d === today && t.status !== "done";
    });
    return { overdue, dueToday };
  }, [tasks, today]);

  const displayTasks = [...overdue, ...dueToday].slice(0, 5);
  const totalCount = overdue.length + dueToday.length;

  async function handleComplete(task) {
    setCompletingId(task.id);
    try {
      await updateTask(task.id, { status: "done" });
    } finally {
      setCompletingId(null);
    }
  }

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setIsAdding(true);
    try {
      await createTask({ title: quickTitle.trim(), dueDate: today });
      setQuickTitle("");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-500/10">
            <svg
              className="h-4 w-4 text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-h4">Today&apos;s Tasks</h3>
        </div>
        {!isLoading && totalCount > 0 && (
          <span className="text-caption text-muted">
            {totalCount} remaining
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonRows />
      ) : displayTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-body-sm text-heading font-medium">
            No tasks due today
          </p>
          <p className="text-caption text-muted mt-1">
            You&apos;re all caught up!
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {displayTasks.map((task) => {
            const isOverdue = task.due_date?.split("T")[0] < today;
            const isCompleting = completingId === task.id;

            return (
              <li
                key={task.id}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-700/40 transition-colors"
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleComplete(task)}
                  disabled={isCompleting}
                  className="shrink-0 h-4 w-4 rounded border border-neutral-600 hover:border-brand-400 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCompleting && (
                    <svg
                      className="h-3 w-3 text-brand-400 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                </button>

                {/* Priority dot */}
                {task.priority && (
                  <span
                    className={`shrink-0 h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] || "bg-neutral-500"}`}
                  />
                )}

                {/* Title */}
                <span
                  className={`flex-1 text-body-sm truncate cursor-pointer ${isOverdue ? "text-red-400" : "text-heading"}`}
                  onClick={() => router.push("/tasks")}
                >
                  {task.title}
                  {isOverdue && (
                    <span className="ml-1.5 text-caption text-red-500 font-medium">
                      overdue
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Quick add */}
      <form onSubmit={handleQuickAdd} className="flex gap-2 mt-auto pt-1">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task for today..."
          className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-body-sm text-heading placeholder-neutral-500 focus:outline-none focus:border-brand-500 transition-colors"
          disabled={isAdding}
        />
        <button
          type="submit"
          disabled={!quickTitle.trim() || isAdding}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-body-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Add
        </button>
      </form>

      {/* Footer */}
      <button
        onClick={() => router.push("/tasks")}
        className="text-caption text-brand-400 hover:text-brand-300 transition-colors text-left cursor-pointer"
      >
        View all tasks →
      </button>
    </div>
  );
}
