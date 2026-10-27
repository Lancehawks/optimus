"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import { ErrorState, Spinner, useToast } from "@/components/ui";
import { useChecklist, useChecklistHistory } from "@/hooks/useChecklist";
import { checklistService } from "@/services/api";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
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
  const {
    sections,
    error: sectionsError,
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useChecklist();
  const [pageOffset, setPageOffset] = useState(0);

  const days = viewMode === "month" ? 30 : 7;
  const dates = useMemo(() => getDateRange(pageOffset, days), [pageOffset, days]);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const todayStr = getTodayStr();

  const {
    logs,
    error: historyError,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useChecklistHistory(startDate, endDate);

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
      <div className="skeleton h-64" role="status" aria-label="Loading history" />
    );
  }

  if (sectionsError || historyError) {
    return (
      <ErrorState
        title="Checklist history is unavailable"
        description="Your checklist data is safe. Retry to load this date range."
        onRetry={() => Promise.all([refetchSections(), refetchHistory()])}
      />
    );
  }

  if (sections.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        Add checklist sections and items first to see your history.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs tabular-nums text-muted">
          {formatDate(startDate)} – {formatDate(endDate)}
        </span>
        <div className="flex items-center rounded-lg border border-border bg-surface shadow-xs">
          <button
            type="button"
            onClick={() => setPageOffset((p) => p - 1)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-l-lg text-muted hover:bg-surface-tertiary hover:text-heading"
            aria-label={isMonth ? "Previous month" : "Previous week"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPageOffset(0)}
            disabled={pageOffset === 0}
            className="h-7 cursor-pointer border-x border-border px-2.5 text-xs font-medium text-heading hover:bg-surface-tertiary disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
          >
            {isMonth ? "This month" : "This week"}
          </button>
          <button
            type="button"
            onClick={() => setPageOffset((p) => p + 1)}
            disabled={pageOffset >= 0}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-r-lg text-muted hover:bg-surface-tertiary hover:text-heading disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={isMonth ? "Next month" : "Next week"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse" style={{ minWidth: isMonth ? "900px" : "520px" }}>
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 min-w-[11rem] border-r border-border bg-surface px-4 py-2.5 text-left text-overline font-normal">
                  Routine
                </th>
                {dates.map((dateStr) => {
                  const info = isMonth ? formatMonthDate(dateStr) : formatShortDate(dateStr);
                  const isToday = dateStr === todayStr;
                  return (
                    <th key={dateStr} className={cn("px-0.5 py-2 text-center font-normal", isMonth ? "min-w-[1.75rem]" : "min-w-[2.75rem]")}>
                      <div className={cn("font-mono text-[0.625rem] uppercase", isToday ? "text-heading" : "text-muted")}>{info.weekday}</div>
                      <div
                        className={cn(
                          "mx-auto mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full font-mono text-2xs tabular-nums",
                          isToday ? "bg-heading text-surface" : "text-muted"
                        )}
                      >
                        {info.day}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.id}>
                  <tr className="bg-surface-secondary">
                    <td colSpan={dates.length + 1} className="sticky left-0 px-4 py-1.5 text-xs font-semibold text-heading">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: section.color }} />
                        {section.name}
                      </span>
                    </td>
                  </tr>
                  {(section.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-border-light last:border-b-0">
                      <td className="sticky left-0 z-10 max-w-[13rem] truncate border-r border-border bg-surface px-4 py-1.5 text-sm text-body">
                        {item.name}
                      </td>
                      {dates.map((dateStr) => {
                        const isCompleted = completionMap[item.id]?.has(dateStr);
                        const isFuture = dateStr > todayStr;
                        return (
                          <td key={dateStr} className="px-0.5 py-1.5 text-center">
                            {!isFuture ? (
                              <button
                                type="button"
                                onClick={() => handleToggleCell(item.id, dateStr)}
                                aria-pressed={Boolean(isCompleted)}
                                aria-label={`${item.name}, ${dateStr}`}
                                className={cn(
                                  "mx-auto flex cursor-pointer items-center justify-center rounded-[4px] transition-colors",
                                  isMonth ? "h-[1.125rem] w-[1.125rem]" : "h-6 w-6",
                                  isCompleted ? "text-white hover:opacity-85" : "bg-surface-tertiary hover:bg-border"
                                )}
                                style={isCompleted ? { backgroundColor: section.color || "var(--brand-500)" } : undefined}
                              >
                                {isCompleted && !isMonth && <Check className="h-3 w-3" strokeWidth={3} />}
                              </button>
                            ) : (
                              <div className={cn("mx-auto rounded-[4px] border border-dashed border-border", isMonth ? "h-[1.125rem] w-[1.125rem]" : "h-6 w-6")} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
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
