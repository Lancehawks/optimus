"use client";

import { Fragment, useSyncExternalStore } from "react";
import LancehawksMark from "@/components/brand/LancehawksMark";
import { cn, toLocalDateStr } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;
const subscribe = () => () => {};

// The visitor's own date. It is null on the server and during hydration, so
// the first client render matches the HTML and the date fills in afterwards.
function useToday() {
  const key = useSyncExternalStore(subscribe, () => toLocalDateStr(new Date()), () => null);
  if (!key) return null;

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const start = new Date(year, 0, 1);
  const daysInYear = Math.round((new Date(year + 1, 0, 1) - start) / DAY_MS);
  const dayOfYear = Math.round((date - start) / DAY_MS) + 1;
  return { year, month: month - 1, day, date, dayOfYear, daysInYear, daysLeft: daysInYear - dayOfYear };
}

// One dot per day of the year: filled for days gone, the accent for today.
function YearGrid({ today }) {
  // Any non-leap year works for the placeholder rendered before the date is known.
  const year = today?.year ?? 2001;

  return (
    <div className="grid grid-cols-[2.25rem_repeat(31,minmax(0,1fr))] items-center gap-y-[7px]">
      {MONTHS.map((label, month) => {
        const length = new Date(year, month + 1, 0).getDate();
        return (
          <Fragment key={label}>
            <span className="font-mono text-[0.6875rem] uppercase leading-none tracking-[0.06em] text-muted">{label}</span>
            {Array.from({ length: 31 }, (_, index) => {
              const day = index + 1;
              if (day > length) return <span key={day} />;
              const isToday = today && month === today.month && day === today.day;
              const isPast = today && (month < today.month || (month === today.month && day < today.day));
              return (
                <span key={day} className="flex h-2.5 items-center justify-center">
                  <span
                    className={cn(
                      "rounded-full transition-colors duration-500",
                      isToday
                        ? "h-2.5 w-2.5 bg-brand-500 ring-4 ring-brand-500/15"
                        : cn("h-[5px] w-[5px]", isPast ? "bg-heading/45" : "bg-heading/12")
                    )}
                  />
                </span>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The wide-screen panel beside the sign-in form. */
export default function MottoPanel() {
  const today = useToday();
  const dateLabel = today?.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <aside
      className="relative hidden overflow-hidden rounded-2xl bg-[#ebe8e1] ring-1 ring-black/[0.04] lg:flex lg:flex-col"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between px-10 pt-9 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted">
        <span>Optimus · Personal OS</span>
        <span className={cn("transition-opacity duration-500", today ? "opacity-100" : "opacity-0")}>{dateLabel || " "}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        <LancehawksMark variant="logo" height={104} />
        <p className="mt-12 font-serif text-[clamp(4.5rem,8.5vw,8.5rem)] leading-[0.9] tracking-[-0.02em] text-heading">
          Carpe <span className="italic">diem</span>
          <span className="text-brand-500">.</span>
        </p>
        <p className="mt-5 font-serif text-[1.375rem] italic text-body">Seize the day. This one won&rsquo;t come round again.</p>
      </div>

      <div className="px-10 pb-10">
        <div className="mx-auto max-w-[34rem]">
          <YearGrid today={today} />
          <div className="mt-5 grid grid-cols-3 border-t border-heading/10 pt-3 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted">
            <span>{today ? `Day ${today.dayOfYear} of ${today.daysInYear}` : " "}</span>
            <span className="flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Today
            </span>
            <span className="text-right">{today ? `${today.daysLeft} to go` : ""}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** A compact panel for narrow screens, where the full panel is hidden. */
export function MottoCard({ className = "" }) {
  const today = useToday();
  const progress = today ? (today.dayOfYear / today.daysInYear) * 100 : 0;

  return (
    <div className={cn("rounded-2xl bg-[#ebe8e1] px-5 pb-5 pt-4 ring-1 ring-black/[0.04]", className)} aria-hidden="true">
      <div className="flex items-center justify-between font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted">
        <span>{today ? `Day ${today.dayOfYear} of ${today.daysInYear}` : " "}</span>
        <span>{today ? `${today.daysLeft} to go` : ""}</span>
      </div>
      <p className="mt-7 font-serif text-[3.25rem] leading-[0.9] tracking-[-0.02em] text-heading">
        Carpe <span className="italic">diem</span>
        <span className="text-brand-500">.</span>
      </p>
      <p className="mt-2 font-serif text-[1.0625rem] italic text-body">Seize the day. This one won&rsquo;t come round again.</p>
      <div className="relative mt-5 h-px bg-heading/12">
        <span className="absolute inset-y-0 left-0 bg-heading/45 transition-[width] duration-700" style={{ width: `${progress}%` }} />
        {today && (
          <span
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 ring-4 ring-brand-500/15"
            style={{ left: `${progress}%` }}
          />
        )}
      </div>
    </div>
  );
}
