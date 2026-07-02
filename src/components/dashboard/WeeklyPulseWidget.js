"use client";

import { useRouter } from "next/navigation";
import { useDashboardStats } from "@/hooks/useDashboard";

function DeltaBadge({ current, previous }) {
  const delta = current - previous;
  if (delta === 0) {
    return (
      <span className="text-caption text-neutral-500 font-medium">—</span>
    );
  }
  const isPositive = delta > 0;
  return (
    <span
      className={`text-caption font-semibold flex items-center gap-0.5 ${
        isPositive ? "text-emerald-400" : "text-red-400"
      }`}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={isPositive ? "M4.5 19.5l15-15M12 4.5h7.5V12" : "M4.5 4.5l15 15M19.5 12v7.5H12"}
        />
      </svg>
      {isPositive ? "+" : ""}
      {delta}
    </span>
  );
}

function StatRow({ label, value, suffix, previous, previousSuffix }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-body-sm text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-body-sm font-semibold text-heading tabular-nums">
          {value}{suffix}
        </span>
        <DeltaBadge current={value} previous={previous} />
      </div>
    </div>
  );
}

function SkeletonContent() {
  return (
    <div className="flex flex-col gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 rounded-lg bg-neutral-700/50 animate-pulse" />
      ))}
    </div>
  );
}

export default function WeeklyPulseWidget() {
  const router = useRouter();
  const { stats, isLoading } = useDashboardStats();

  return (
    <div className="card p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-purple-500/10">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
          </svg>
        </div>
        <h3 className="text-h4">Weekly Pulse</h3>
      </div>

      {/* Content */}
      {isLoading || !stats ? (
        <SkeletonContent />
      ) : (
        <div className="flex flex-col">
          <StatRow
            label="Tasks completed"
            value={stats.tasksCompletedThisWeek}
            previous={stats.tasksCompletedLastWeek}
          />
          <StatRow
            label="Habit rate"
            value={stats.habitRateThisWeek}
            suffix="%"
            previous={stats.habitRateLastWeek}
          />

          <StatRow
            label="Notes written"
            value={stats.notesThisWeek}
            previous={stats.notesLastWeek}
          />
        </div>
      )}

      {/* Footer */}
      <p className="text-caption text-muted mt-auto">
        vs. last week
      </p>
    </div>
  );
}
