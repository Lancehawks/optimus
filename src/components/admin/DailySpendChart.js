"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCount, formatUsd, formatUtcDay } from "./format";

const PLOT_HEIGHT = 160;

// A clean axis maximum: the smallest 1, 2, 2.5 or 5 × 10^n at or above the peak.
function niceMax(value) {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

function DayTable({ days }) {
  const used = days.filter((day) => day.calls > 0);
  if (used.length === 0) return <p className="py-6 text-sm text-muted">No assistant usage in the last 30 days.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-[0.6875rem] text-muted">
          <th scope="col" className="py-2 font-medium">Day (UTC)</th>
          <th scope="col" className="py-2 text-right font-medium">Model calls</th>
          <th scope="col" className="py-2 text-right font-medium">Estimated cost</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {used.map((day) => (
          <tr key={day.day}>
            <td className="py-2 text-body">{formatUtcDay(day.day, { weekday: "short", month: "short", day: "numeric" })}</td>
            <td className="py-2 text-right font-mono tabular-nums text-heading">{formatCount(day.calls)}</td>
            <td className="py-2 text-right font-mono tabular-nums text-heading">{formatUsd(day.cost)}</td>
          </tr>
        ))}
      </tbody>
      <caption className="caption-bottom pt-2 text-left text-xs text-muted">Days without usage are left out.</caption>
    </table>
  );
}

// One series (estimated spend per day), so no legend: the title names it.
// Each column's full-height slot is its hover and focus target.
export default function DailySpendChart({ days }) {
  const [view, setView] = useState("chart");
  const [active, setActive] = useState(null);
  const peak = Math.max(0, ...days.map((day) => day.cost));
  const axisMax = niceMax(peak);
  const ticks = axisMax > 0 ? [axisMax, axisMax / 2, 0] : [0];
  const activeDay = active === null ? null : days[active];
  const middle = Math.floor((days.length - 1) / 2);

  return (
    <figure className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <figcaption>
          <p className="text-sm font-medium text-heading">Daily workspace key spend</p>
          <p className="text-xs text-muted">Cost per day over the last 30 days, in UTC. Members&apos; own keys aren&apos;t included.</p>
        </figcaption>
        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-tertiary hover:text-heading"
          aria-pressed={view === "table"}
        >
          {view === "chart" ? "Show as table" : "Show as chart"}
        </button>
      </div>

      {view === "table" ? (
        <DayTable days={days} />
      ) : peak === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No assistant usage in the last 30 days.</p>
      ) : (
        <div className="flex gap-3">
          <div className="relative w-14 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 font-mono text-[0.6875rem] tabular-nums text-muted"
                style={{ top: `${(1 - tick / axisMax) * 100}%` }}
              >
                {formatUsd(tick)}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: PLOT_HEIGHT }} onPointerLeave={() => setActive(null)}>
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute inset-x-0 h-px bg-border"
                  style={{ top: `${(1 - tick / axisMax) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {days.map((day, index) => {
                  const height = (day.cost / axisMax) * 100;
                  return (
                    <button
                      key={day.day}
                      type="button"
                      onPointerEnter={() => setActive(index)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                      aria-label={`${formatUtcDay(day.day)}: ${formatUsd(day.cost)}, ${day.calls} model calls`}
                      className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
                    >
                      <span
                        className={cn(
                          "block w-full max-w-6 rounded-t-[4px] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary/40",
                          active === index ? "bg-primary-hover" : "bg-primary",
                          active !== null && active !== index && "opacity-70"
                        )}
                        style={{ height: day.cost > 0 ? `max(${height}%, 2px)` : 0 }}
                      />
                    </button>
                  );
                })}
              </div>
              {activeDay && (
                <div
                  className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-md"
                  style={{ left: `${Math.min(92, Math.max(8, ((active + 0.5) / days.length) * 100))}%` }}
                  role="status"
                >
                  <p className="font-mono text-[0.8125rem] font-medium tabular-nums text-heading">{formatUsd(activeDay.cost)}</p>
                  <p className="whitespace-nowrap text-[0.6875rem] text-muted">
                    {formatUtcDay(activeDay.day, { weekday: "short", month: "short", day: "numeric" })} · {formatCount(activeDay.calls)} calls
                  </p>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[0.6875rem] text-muted" aria-hidden="true">
              <span>{formatUtcDay(days[0].day)}</span>
              <span>{formatUtcDay(days[middle].day)}</span>
              <span>{formatUtcDay(days.at(-1).day)}</span>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
