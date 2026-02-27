"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHabits, useHabitMutations } from "@/hooks/useHabits";

const RING_SIZE = 88;
const RING_RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ done, total }) {
  const pct = total > 0 ? done / total : 0;
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <svg width={RING_SIZE} height={RING_SIZE} className="shrink-0">
      {/* Track */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        className="text-neutral-700"
      />
      {/* Progress */}
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="7"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      {/* Center text */}
      <text
        x={RING_SIZE / 2}
        y={RING_SIZE / 2 - 4}
        textAnchor="middle"
        className="fill-white font-bold"
        style={{ fontSize: 18, fontWeight: 700 }}
      >
        {done}/{total}
      </text>
      <text
        x={RING_SIZE / 2}
        y={RING_SIZE / 2 + 13}
        textAnchor="middle"
        className="fill-neutral-400"
        style={{ fontSize: 10 }}
      >
        habits
      </text>
    </svg>
  );
}

function SkeletonContent() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="h-[88px] w-[88px] rounded-full bg-neutral-700/50 animate-pulse shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 rounded-lg bg-neutral-700/50 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HabitsWidget() {
  const router = useRouter();
  const { habits, isLoading, refetch } = useHabits();
  const { toggleLog } = useHabitMutations(refetch);
  const [togglingId, setTogglingId] = useState(null);

  const total = habits.length;
  const done = habits.filter((h) => h.completed_today).length;
  const displayHabits = habits.slice(0, 5);

  async function handleToggle(habit) {
    setTogglingId(habit.id);
    try {
      await toggleLog(habit.id);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10">
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          <h3 className="text-h4">Today&apos;s Habits</h3>
        </div>
        {!isLoading && total > 0 && (
          <span className={`text-caption font-medium ${done === total ? "text-emerald-400" : "text-muted"}`}>
            {done === total ? "All done!" : `${total - done} left`}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonContent />
      ) : total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-body-sm text-heading font-medium">No habits yet</p>
          <p className="text-caption text-muted mt-1">Build your routine</p>
          <button
            onClick={() => router.push("/habits")}
            className="mt-3 text-caption text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
          >
            Add your first habit →
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          {/* Ring */}
          <ProgressRing done={done} total={total} />

          {/* Habit rows */}
          <ul className="flex-1 flex flex-col gap-1 min-w-0">
            {displayHabits.map((habit) => {
              const isToggling = togglingId === habit.id;
              return (
                <li
                  key={habit.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-700/40 transition-colors"
                >
                  {/* Color dot */}
                  <span
                    className="shrink-0 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: habit.color || "#22c55e" }}
                  />

                  {/* Name */}
                  <span
                    className={`flex-1 text-body-sm truncate ${habit.completed_today ? "line-through text-muted" : "text-heading"}`}
                  >
                    {habit.name}
                  </span>

                  {/* Streak */}
                  {habit.current_streak > 0 && (
                    <span className="shrink-0 text-caption text-amber-400 font-medium">
                      🔥{habit.current_streak}
                    </span>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(habit)}
                    disabled={isToggling}
                    className={`shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 ${
                      habit.completed_today
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-neutral-600 hover:border-emerald-500"
                    }`}
                  >
                    {isToggling ? (
                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : habit.completed_today ? (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {habits.length > 5 && (
              <li className="text-caption text-muted px-2">
                +{habits.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Footer */}
      <button
        onClick={() => router.push("/habits")}
        className="text-caption text-brand-400 hover:text-brand-300 transition-colors text-left mt-auto cursor-pointer"
      >
        View all habits →
      </button>
    </div>
  );
}
