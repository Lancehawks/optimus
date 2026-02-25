"use client";

import { useMemo } from "react";

export default function HabitStats({ stats, color }) {
  if (!stats) return null;

  const { currentStreak, longestStreak, completionRate, monthlyData } = stats;

  const maxCompleted = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return 1;
    return Math.max(1, ...monthlyData.map((m) => Number(m.completed) || 0));
  }, [monthlyData]);

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString("en-US", { month: "short" });
  };

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-heading" style={{ color }}>
            {currentStreak}
          </div>
          <div className="text-caption text-muted">days streak</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-heading" style={{ color }}>
            {longestStreak}
          </div>
          <div className="text-caption text-muted">best streak</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-heading" style={{ color }}>
            {completionRate}%
          </div>
          <div className="text-caption text-muted">completion</div>
        </div>
      </div>

      {/* Monthly bar chart */}
      {monthlyData && monthlyData.length > 0 && (
        <div>
          <h4 className="text-body-sm text-heading! font-medium mb-3">
            Last 6 Months
          </h4>
          <div className="flex items-end justify-between gap-2" style={{ height: "120px" }}>
            {monthlyData.map((m) => {
              const count = Number(m.completed) || 0;
              const heightPct = Math.max(4, (count / maxCompleted) * 80);

              return (
                <div
                  key={m.month}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                >
                  <span
                    className="text-[0.65rem] font-medium mb-1"
                    style={{ color }}
                  >
                    {count}
                  </span>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${heightPct}px`,
                      backgroundColor: color,
                      opacity: 0.8,
                    }}
                  />
                  <span className="text-[0.6rem] text-muted mt-1.5">
                    {formatMonth(m.month)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
