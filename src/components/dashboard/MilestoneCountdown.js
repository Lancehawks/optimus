"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { useNow } from "@/components/founder/hooks/useNow";
import { padNumber } from "@/components/founder/utils/format";
import { getRemainingTime } from "@/components/founder/utils/time";
import { cn } from "@/lib/utils";

const UNITS = [
  ["days", "Days"],
  ["hours", "Hours"],
  ["minutes", "Mins"],
  ["seconds", "Secs"],
];

function formatTarget(targetAt, timeZone) {
  if (!targetAt) return "No date has been set yet";
  return new Date(targetAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone });
}

/** The Founder Lobby's shared countdown. Re-renders every second, so it stays a leaf. */
export default function MilestoneCountdown({ countdown, timeZone }) {
  const now = useNow();
  const remaining = getRemainingTime(countdown.targetAt, now);
  const targetLabel = useMemo(() => formatTarget(countdown.targetAt, timeZone), [countdown.targetAt, timeZone]);

  return (
    <section className="card @container flex flex-col px-5 py-6 sm:px-8" aria-labelledby="milestone-title">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-overline">{remaining?.complete ? "Milestone reached" : "Active milestone"}</p>
        <Link href="/founder" className="group inline-flex shrink-0 items-center gap-1 text-xs text-muted transition-colors hover:text-heading">
          Founder Lobby
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <h2 id="milestone-title" className="text-title mt-3 text-balance break-words">{countdown.title}</h2>
      <p className="mt-1.5 text-xs text-muted">{targetLabel}</p>

      <div className="mt-auto pt-6">
        <div
          role="timer"
          aria-label={remaining
            ? `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds remaining`
            : "Countdown is not set"}
          className="grid grid-cols-4 divide-x divide-heading/10 border-t border-heading/10 pt-4"
        >
          {UNITS.map(([key, label]) => (
            <div key={key} className="min-w-0 text-center">
              <p className={cn(
                "font-mono text-[1.75rem] leading-none tracking-[-0.02em] tabular-nums @md:text-[2.5rem]",
                key === "seconds" ? "text-muted" : "text-heading"
              )}>
                {remaining ? padNumber(remaining[key]) : "--"}
              </p>
              <p className="mt-2 font-mono text-2xs uppercase tracking-[0.08em] text-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MilestoneCountdownSkeleton() {
  return (
    <div className="card flex flex-col gap-4 px-5 py-6 sm:px-8" aria-hidden="true">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton h-9 w-2/3" />
      <div className="skeleton mt-auto h-14" />
    </div>
  );
}

/** One quiet line in place of the card: the title and date never reach a locked session. */
export function MilestoneCountdownNotice({ status, onRetry }) {
  if (status === "locked") {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Milestone countdown is locked.
        <Link href="/founder" className="group inline-flex items-center gap-1 font-medium text-heading">
          Unlock in the Founder Lobby
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      Milestone countdown couldn&apos;t load.
      <button type="button" onClick={() => onRetry()} className="cursor-pointer font-medium text-heading underline underline-offset-4">
        Try again
      </button>
    </p>
  );
}
