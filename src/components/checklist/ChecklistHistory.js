"use client";

import { useState, useMemo, useCallback } from "react";
import { Spinner, useToast } from "@/components/ui";
import { useChecklist, useChecklistHistory } from "@/hooks/useChecklist";
import { checklistService } from "@/services/api";
import { cn } from "@/lib/utils";

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return { day: d.getDate(), weekday: d.toLocaleDateString("en-US", { weekday: "short" }) };
}

function formatMonthDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return { day: d.getDate(), weekday: d.toLocaleDateString("en-US", { weekday: "narrow" }) };
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(offset, days) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - (days - 1) + offset * days);

  for (let i = 0; i < days; i++) {
    const d = new Date(startDay);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export default function ChecklistHistory({ viewMode = "week" }) {
  const { addToast } = useToast();
  const { sections, isLoading: sectionsLoading } = useChecklist();
  const [pageOffset, setPageOffset] = useState(0);

  const days = viewMode === "month" ? 30 : 7;
  const dates = useMemo(() => getDateRange(pageOffset, days), [pageOffset, days]);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const todayStr = getTodayStr();

  const { logs, isLoading: historyLoading, refetch: refetchHistory } = useChecklistHistory(startDate, endDate);

  // Build lookup: itemId -> Set of completed date strings
  const completionMap = useMemo(() => {
    const map = {};
    for (const log of logs) {
      if (log.completed) {
        const dateStr = typeof log.log_date === "string"
          ? log.log_date.split("T")[0]
          : (() => { const d = new Date(log.log_date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
        if (!map[log.item_id]) map[log.item_id] = new Set();
        map[log.item_id].add(dateStr);
      }
    }
    return map;
  }, [logs]);

  const handleToggleCell = useCallback(async (itemId, dateStr) => {
    const isCompleted = completionMap[itemId]?.has(dateStr);
    try {
      await checklistService.toggleLog({ item_id: itemId, date: dateStr, completed: !isCompleted });
      refetchHistory();
    } catch (error) {
      addToast({ message: "Failed to update", type: "error" });
    }
  }, [completionMap, refetchHistory, addToast]);

  const isLoading = sectionsLoading || historyLoading;
  const isMonth = viewMode === "month";

  if (isLoading && sections.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="text-muted text-body-sm text-center py-12">
        Create checklist sections and items first to see tracking.
      </p>
    );
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setPageOffset((p) => p - 1)}
          className="btn-ghost rounded-lg px-3 py-1.5 text-body-sm cursor-pointer flex items-center gap-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {isMonth ? "Prev Month" : "Prev Week"}
        </button>
        <span className="text-body-sm text-muted">
          {formatDate(startDate)} — {formatDate(endDate)}
        </span>
        {pageOffset < 0 ? (
          <button
            onClick={() => setPageOffset((p) => p + 1)}
            className="btn-ghost rounded-lg px-3 py-1.5 text-body-sm cursor-pointer flex items-center gap-1"
          >
            {isMonth ? "Next Month" : "Next Week"}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ) : (
          <span className="text-body-sm text-muted/50 px-3 py-1.5">Current</span>
        )}
      </div>

      {/* Spreadsheet */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse" style={{ minWidth: isMonth ? "900px" : "500px" }}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-caption text-muted font-medium px-3 py-2.5 sticky left-0 bg-surface z-10 min-w-[160px] border-r border-border/50">
                  Item
                </th>
                {dates.map((dateStr) => {
                  const info = isMonth ? formatMonthDate(dateStr) : formatShortDate(dateStr);
                  const isToday = dateStr === todayStr;
                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        "text-center px-0.5 py-2",
                        isMonth ? "min-w-[28px]" : "min-w-[44px]",
                        isToday && "bg-brand-500/10"
                      )}
                    >
                      <div className={cn("text-[9px] font-normal", isToday ? "text-brand-400" : "text-muted")}>
                        {info.weekday}
                      </div>
                      <div className={cn(
                        isMonth ? "text-[10px]" : "text-caption",
                        "font-medium",
                        isToday ? "text-brand-400" : "text-muted"
                      )}>
                        {info.day}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <>
                  {/* Section header row */}
                  <tr key={`section-${section.id}`} className="bg-surface-secondary/50">
                    <td
                      colSpan={dates.length + 1}
                      className="px-3 py-1.5 text-caption font-semibold text-heading sticky left-0"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: section.color }} />
                        {section.name}
                      </div>
                    </td>
                  </tr>
                  {/* Item rows */}
                  {(section.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-border/20 hover:bg-surface-secondary/20">
                      <td className="text-body-sm text-heading px-3 py-1.5 sticky left-0 bg-surface z-10 border-r border-border/50 truncate max-w-[200px]">
                        {item.name}
                      </td>
                      {dates.map((dateStr) => {
                        const isCompleted = completionMap[item.id]?.has(dateStr);
                        const isToday = dateStr === todayStr;
                        const isFuture = dateStr > todayStr;
                        return (
                          <td
                            key={dateStr}
                            className={cn(
                              "text-center px-0.5 py-1.5",
                              isToday && "bg-brand-500/5"
                            )}
                          >
                            {!isFuture ? (
                              <button
                                onClick={() => handleToggleCell(item.id, dateStr)}
                                className={cn(
                                  "mx-auto flex items-center justify-center cursor-pointer transition-all rounded",
                                  isMonth ? "w-5 h-5" : "w-6 h-6 rounded-md",
                                  isCompleted
                                    ? "hover:opacity-80"
                                    : "border border-border/40 hover:border-neutral-500"
                                )}
                                style={isCompleted ? { backgroundColor: section.color } : undefined}
                              >
                                {isCompleted && (
                                  <svg className={cn("text-white", isMonth ? "h-2.5 w-2.5" : "h-3 w-3")} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <div className={cn("mx-auto", isMonth ? "w-5 h-5" : "w-6 h-6")} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {historyLoading && (
        <div className="flex justify-center py-3">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
}
