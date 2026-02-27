"use client";

import { cn } from "@/lib/utils";
import { Badge, Dropdown } from "@/components/ui";

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(toDateStr(d));
  }
  return days;
}

const last7Days = getLast7Days();

export default function HabitCard({ habit, onClick, onToggleToday, onEdit, onPause }) {
  const isCompletedToday = habit.completed_today === true || habit.completed_today === "true";
  const completedSet = new Set(habit.last_7_dates || []);
  const currentStreak = Number(habit.current_streak) || 0;

  const menuItems = [
    {
      label: "Edit",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      ),
      onClick: () => onEdit?.(habit),
    },
    {
      label: habit.is_active ? "Pause" : "Resume",
      icon: habit.is_active ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
        </svg>
      ),
      onClick: () => onPause?.(habit),
    },
  ];

  return (
    <div
      className={cn("card p-4 cursor-pointer transition-opacity", !habit.is_active && "opacity-60")}
      style={{ borderLeft: `4px solid ${habit.color}` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <h3 className="text-body-sm text-heading! font-medium truncate">
              {habit.name}
            </h3>
            {habit.category && (
              <Badge variant="default" size="sm">{habit.category}</Badge>
            )}
            <Badge variant="info" size="sm">
              {habit.frequency === "weekly" ? "Weekly" : "Daily"}
            </Badge>
          </div>

          {/* Row 2: 7-day dot trail + streak */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1" title="Last 7 days">
              {last7Days.map((dateStr) => (
                <div
                  key={dateStr}
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: completedSet.has(dateStr)
                      ? habit.color
                      : habit.color + "25",
                  }}
                />
              ))}
            </div>
            {currentStreak > 0 && (
              <span className="text-caption flex items-center gap-0.5 shrink-0 ml-3">
                <span className="font-semibold" style={{ color: habit.color }}>
                  {currentStreak}
                </span>
                <span className="text-muted"> day streak</span>
              </span>
            )}
          </div>
        </div>

        {/* Right side: menu + today toggle */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Dropdown menu */}
          <Dropdown
            align="right"
            trigger={
              <button
                className="btn-ghost p-1.5 rounded-lg cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                title="Options"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
              </button>
            }
            items={menuItems}
          />

          {/* Today toggle */}
          <button
            className="h-8 w-8 rounded-full border-2 shrink-0 cursor-pointer transition-colors flex items-center justify-center"
            style={{
              borderColor: habit.color,
              backgroundColor: isCompletedToday ? habit.color : "transparent",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (habit.is_active) onToggleToday?.();
            }}
            disabled={!habit.is_active}
            title={isCompletedToday ? "Mark incomplete" : "Mark complete"}
          >
            {isCompletedToday && (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
