"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { dayProgress, formatDuration } from "@/lib/dayProgress";

const QUARTERS = 4;
const SLOTS = 24 * QUARTERS;
const HOUR_LABELS = ["12 AM", "6 AM", "Noon", "6 PM"];

// The current minute, checked every 20 seconds. It is null on the server and
// during hydration, so the first client render matches the HTML and the day
// fills in afterwards.
function subscribe(onChange) {
  const timer = setInterval(onChange, 20 * 1000);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noMinute = () => null;

/** Today as dots, one per quarter hour: the dashboard's take on the sign-in year grid. */
export default function DayProgress({ timeZone, className }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, noMinute);
  const progress = minute === null ? null : dayProgress(new Date(minute * 60_000), timeZone);
  const current = progress ? Math.min(SLOTS - 1, Math.floor(progress.fraction * SLOTS)) : -1;

  return (
    <section className={cn("card px-5 py-6 sm:px-8", className)} aria-labelledby="day-progress-title">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-center lg:gap-12">
        <div>
          <p className="text-overline">
            {progress ? `Today · ${Math.round(progress.fraction * 100)}% gone` : "Today"}
          </p>
          <h2 id="day-progress-title" className="mt-3 font-serif text-[3rem] leading-[0.9] tracking-[-0.02em] text-heading">
            Carpe <span className="italic">diem</span>
            <span className="text-brand-500">.</span>
          </h2>
          <p className="mt-2.5 text-balance font-serif text-[1.125rem] italic text-body">
            Seize the day. This one won&rsquo;t come round again.
          </p>
        </div>

        <div>
          {/* Hours run left to right; each column is one hour, top to bottom by quarter. */}
          <div className="grid grid-flow-col grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-4 gap-y-[7px]" aria-hidden="true">
            {Array.from({ length: SLOTS }, (_, slot) => (
              <span key={slot} className="flex h-2.5 items-center justify-center">
                <span
                  className={cn(
                    "rounded-full transition-colors duration-500",
                    slot === current
                      ? "h-2.5 w-2.5 bg-brand-500 ring-4 ring-brand-500/15"
                      : cn("h-[5px] w-[5px]", slot < current ? "bg-heading/45" : "bg-heading/12")
                  )}
                />
              </span>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-4 font-mono text-2xs uppercase leading-none tracking-[0.06em] text-muted" aria-hidden="true">
            {HOUR_LABELS.map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="mt-5 grid grid-cols-3 border-t border-heading/10 pt-3 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
            <span>{progress ? `${formatDuration(progress.elapsedMinutes)} gone` : " "}</span>
            <span className="flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
              Now
            </span>
            <span className="text-right">{progress ? `${formatDuration(progress.remainingMinutes)} left` : ""}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
