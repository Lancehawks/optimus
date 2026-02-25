"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";

export default function HabitCard({ habit, onClick, onToggleToday }) {
  const completedCount = Number(habit.completed_last_7) || 0;
  const isCompletedToday = habit.completed_today === true || habit.completed_today === "true";

  return (
    <div
      className="card card-hover p-4 cursor-pointer"
      style={{ borderLeft: `4px solid ${habit.color}` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-body-sm text-heading! font-medium truncate">
              {habit.name}
            </h3>
            {habit.category && (
              <Badge variant="default" size="sm">
                {habit.category}
              </Badge>
            )}
            <Badge variant="info" size="sm">
              {habit.frequency === "weekly" ? "Weekly" : "Daily"}
            </Badge>
          </div>

          {/* Row 2: Streak + weekly count */}
          <div className="flex items-center gap-3 text-caption text-muted">
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z"
                />
              </svg>
              <span style={{ color: habit.color }} className="font-medium">
                {completedCount}/7
              </span>
              <span>this week</span>
            </span>
          </div>
        </div>

        {/* Toggle today button */}
        <button
          className={cn(
            "h-8 w-8 rounded-full border-2 shrink-0 cursor-pointer transition-colors flex items-center justify-center"
          )}
          style={{
            borderColor: habit.color,
            backgroundColor: isCompletedToday ? habit.color : "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleToday();
          }}
          title={isCompletedToday ? "Mark incomplete" : "Mark complete"}
        >
          {isCompletedToday && (
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
