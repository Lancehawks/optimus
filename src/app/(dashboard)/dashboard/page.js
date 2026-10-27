"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Circle, Clock3, Moon, Plus, Sparkles, Sun, Sunrise, Sunset, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { cn, toLocalDateStr } from "@/lib/utils";
import { dateKey, wallDate, wallDateToInstant, zonedInputToDate, resolveTimeZone } from "@/lib/calendarTime";
import { getEventsForDay } from "@/lib/calendarUtils";
import { getEventDisplayColor } from "@/lib/eventDisplay";
import MorningReviewModal, {
  REVIEW_DISMISSED_EVENT,
  dismissReviewForToday,
  shouldShowReview,
} from "@/components/dashboard/MorningReviewModal";
import TodayRoutines from "@/components/dashboard/TodayRoutines";
import DayProgress from "@/components/dashboard/DayProgress";
import ProjectMark from "@/components/projects/ProjectMark";
import { SectionHeading } from "@/components/dashboard/SectionHeading";
import { Button, ErrorState } from "@/components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;
const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

function valueDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toLocalDateStr(date);
}

function dueLabel(value, todayStart) {
  const key = valueDateKey(value);
  if (!key) return "No date";
  const date = new Date(`${key}T00:00:00`);
  const diff = Math.round((date - todayStart) / DAY_MS);
  if (diff < 0) return `${Math.abs(diff)}d late`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function formatClock(value, timeZone = "UTC") {
  if (!value) return "All day";
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
    const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "All day";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });
}

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function dayPhaseIcon(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return { Icon: Sunrise, tone: "text-warning" };
  if (hour >= 11 && hour < 17) return { Icon: Sun, tone: "text-warning" };
  if (hour >= 17 && hour < 20) return { Icon: Sunset, tone: "text-warning" };
  return { Icon: Moon, tone: "text-primary" };
}

function attentionMeta(task, todayStart) {
  const dueKey = valueDateKey(task.due_date);
  const todayKey = toLocalDateStr(todayStart);
  if (dueKey && dueKey < todayKey) return { label: "Overdue", tone: "danger", score: 0 };
  if (Number(task.blocking_count) > 0) return { label: "Blocked", tone: "danger", score: 1 };
  if (task.status === "on_hold") return { label: "On hold", tone: "warning", score: 2 };
  if (task.priority === "urgent") return { label: "Urgent", tone: "danger", score: 3 };
  if (task.priority === "high") return { label: "High", tone: "warning", score: 4 };
  return null;
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function summarySentence({ attention, dueToday, eventsToday }) {
  const parts = [];
  if (attention > 0) parts.push(`${pluralize(attention, "item")} need${attention === 1 ? "s" : ""} attention`);
  if (dueToday > 0) parts.push(`${pluralize(dueToday, "task")} due today`);
  if (eventsToday > 0) parts.push(`${pluralize(eventsToday, "event")} on the calendar`);
  if (parts.length === 0) return "Nothing is pressing. A good day to move one meaningful thing forward.";
  if (parts.length === 1) return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}.`;
  const last = parts.pop();
  const sentence = `${parts.join(", ")} and ${last}.`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

/* ── Plan prompt ─────────────────────────────────────────────────── */

function PlanDayPrompt({ timeZone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sync = () => setVisible(shouldShowReview(timeZone));
    sync();
    window.addEventListener(REVIEW_DISMISSED_EVENT, sync);
    return () => window.removeEventListener(REVIEW_DISMISSED_EVENT, sync);
  }, [timeZone]);

  if (!visible) return null;

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-heading ring-1 ring-border">
        <Sunrise className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-heading">Plan your day</p>
        <p className="text-xs text-muted">Review today&apos;s schedule and tasks, then apply your day plan.</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={() => window.dispatchEvent(new Event("optimus-open-review"))}>
          Start review
        </Button>
        <button
          type="button"
          onClick={() => dismissReviewForToday(timeZone)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
          aria-label="Dismiss for today"
          title="Not today"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Agenda ──────────────────────────────────────────────────────── */

function AgendaRow({ item, past, current }) {
  const Icon = item.kind === "task" ? Circle : item.kind === "routine" ? Clock3 : null;
  return (
    <Link
      href={item.href}
      aria-current={current ? "time" : undefined}
      className={cn(
        "group grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-secondary",
        past && "opacity-55"
      )}
    >
      <span className={cn("font-mono text-xs tabular-nums", current ? "text-brand-500" : "text-muted")}>{item.whenLabel}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.75} />
        ) : (
          <span className="h-3.5 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        )}
        <span className="truncate text-sm text-heading">{item.title}</span>
      </span>
      <span className="hidden truncate text-xs text-muted sm:block">{item.sourceLabel}</span>
    </Link>
  );
}

function NowMarker({ label }) {
  return (
    <div className="relative grid grid-cols-[4.5rem_1fr] items-center gap-3 px-4 py-1" aria-label={`Now, ${label}`}>
      <span className="font-mono text-2xs font-medium tabular-nums text-brand-500">{label}</span>
      <span className="relative h-px bg-brand-500">
        <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-brand-500" />
      </span>
    </div>
  );
}

function Agenda({ todayItems, laterGroups, loading, nowLabel, nowTimestamp }) {
  // Items are sorted by start, so the marker sits between what has started and what hasn't.
  // Anything still running stays above it at full strength.
  const firstUpcoming = todayItems.findIndex((item) => item.timestamp > nowTimestamp);
  const isPast = (item) => (item.endTimestamp ?? item.timestamp) < nowTimestamp;

  return (
    <section>
      <SectionHeading title="Agenda" count={loading ? null : todayItems.length} href="/calendar" actionLabel="Calendar" />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-4">
            {[0, 1, 2, 3].map((row) => <div key={row} className="skeleton h-4" />)}
          </div>
        ) : todayItems.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5">
            <CalendarDays className="h-4 w-4 text-muted" strokeWidth={1.75} />
            <p className="text-sm text-muted">Nothing scheduled today. Your time is your own.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {todayItems.map((item, index) => (
              <div key={item.key}>
                {index === firstUpcoming && index > 0 && <NowMarker label={nowLabel} />}
                <AgendaRow
                  item={item}
                  past={isPast(item)}
                  current={!isPast(item) && item.timestamp <= nowTimestamp && item.kind !== "task" && item.whenLabel !== "All day"}
                />
              </div>
            ))}
            {firstUpcoming === -1 && <NowMarker label={nowLabel} />}
          </div>
        )}

        {!loading && laterGroups.length > 0 && (
          <div className="border-t border-border bg-surface-secondary/60">
            {laterGroups.map((group) => (
              <div key={group.key} className="border-b border-border last:border-b-0">
                <p className="px-4 pb-1 pt-3 text-overline">{group.label}</p>
                <div className="pb-1.5">
                  {group.items.map((item) => <AgendaRow key={item.key} item={item} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Needs attention ─────────────────────────────────────────────── */

const toneText = { danger: "text-danger", warning: "text-warning" };

function AttentionList({ items, total, loading, todayStart }) {
  return (
    <section>
      <SectionHeading title="Needs attention" count={loading ? null : total} href="/tasks" actionLabel="All tasks" />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-4">
            {[0, 1, 2].map((row) => <div key={row} className="skeleton h-4" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-5">
            <p className="text-sm text-heading">You&apos;re clear.</p>
            <p className="mt-0.5 text-xs text-muted">Nothing overdue, blocked or marked urgent.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.slice(0, 6).map(({ task, meta }) => (
              <li key={task.id}>
                <Link
                  href={`/tasks?task_id=${task.id}`}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-secondary"
                >
                  <Circle className="h-3.5 w-3.5 shrink-0 text-border-strong group-hover:text-muted" strokeWidth={2} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-heading">{task.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      {task.project_color && (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.project_color }} />
                      )}
                      {task.project_name || "Personal"}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-xs font-medium", toneText[meta.tone])}>{meta.label}</span>
                  <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
                    {dueLabel(task.due_date, todayStart)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── Projects ────────────────────────────────────────────────────── */

const healthTone = {
  danger: "text-danger",
  success: "text-muted",
  complete: "text-success",
  neutral: "text-muted",
};

function ProjectPulse({ projects, loading }) {
  return (
    <section>
      <SectionHeading title="Projects" count={loading ? null : projects.length} href="/projects" />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-4 p-4">
            {[0, 1].map((row) => <div key={row} className="skeleton h-4" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="px-4 py-5">
            <p className="text-sm text-heading">No active projects</p>
            <Link href="/projects" className="mt-1 inline-block text-xs text-muted underline underline-offset-4 hover:text-heading">
              Start one
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {projects.slice(0, 5).map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects?project_id=${project.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-surface-secondary"
                >
                  <span className="flex items-center gap-2.5">
                    <ProjectMark project={project} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-heading">{project.name}</span>
                    <span className={cn("shrink-0 text-xs", healthTone[project.healthTone])}>{project.health}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-3 pl-7">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
                      <span
                        className={cn("animate-grow-x block h-full rounded-full", project.healthTone === "danger" ? "bg-danger" : "bg-heading")}
                        style={{ width: `${project.progress}%` }}
                      />
                    </span>
                    <span className="w-9 text-right font-mono text-2xs tabular-nums text-muted">{project.progress}%</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── Week ────────────────────────────────────────────────────────── */

function WeekStrip({ days, summary, loading, todayKey }) {
  const scale = Math.max(4, ...days.map((day) => day.total));
  return (
    <section>
      <SectionHeading title="This week" count={loading ? null : `${summary.due + summary.events} items`} />
      <div className="card p-4">
        <div className="grid grid-cols-7 gap-2" aria-label="Tasks and events per day this week">
          {days.map((day) => {
            const taskHeight = day.total ? ((day.open + day.done) / scale) * 100 : 0;
            const eventHeight = day.total ? (day.events / scale) * 100 : 0;
            const isToday = day.key === todayKey;
            return (
              <div key={day.key} className="flex flex-col items-center gap-2" title={day.title}>
                <div className="flex h-16 w-full flex-col justify-end gap-px overflow-hidden rounded-[3px] bg-surface-secondary">
                  {eventHeight > 0 && <span className="w-full bg-border-strong" style={{ height: `${eventHeight}%` }} />}
                  {taskHeight > 0 && (
                    <span className={cn("w-full", day.isPast && day.open > 0 ? "bg-danger" : "bg-heading")} style={{ height: `${taskHeight}%` }} />
                  )}
                </div>
                <span className={cn("font-mono text-2xs uppercase", isToday ? "font-medium text-heading" : "text-muted")}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-heading" />Tasks</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-border-strong" />Calendar</span>
          <span className="ml-auto font-mono tabular-nums">{summary.done} done</span>
        </div>
      </div>
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const { overview, error, isLoading, refetch, today: todayStart, weekStart, upcomingEnd } = useDashboardOverview();
  const todayKey = toLocalDateStr(todayStart);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const viewModel = useMemo(() => {
    const metrics = overview?.metrics || {};
    const projects = overview?.projects || [];
    const events = overview?.events || [];
    const blocks = overview?.dayPlanBlocks || [];
    const upcomingTasks = overview?.upcomingTasks || [];
    const weeklyTaskMap = new Map((overview?.weeklyTasks || []).map((day) => [valueDateKey(day.due_date), day]));
    const projectColors = new Map(projects.map((project) => [project.id, project.color]));

    const attentionTasks = (overview?.attentionTasks || [])
      .map((task) => ({
        task: { ...task, project_color: task.project_color || projectColors.get(task.project_id) },
        meta: attentionMeta(task, todayStart),
      }))
      .filter((item) => item.meta)
      .sort((a, b) => {
        if (a.meta.score !== b.meta.score) return a.meta.score - b.meta.score;
        const aDate = valueDateKey(a.task.due_date) || "9999-12-31";
        const bDate = valueDateKey(b.task.due_date) || "9999-12-31";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return (priorityRank[a.task.priority] ?? 9) - (priorityRank[b.task.priority] ?? 9);
      });

    const projectHealth = projects
      .map((project) => {
        const done = Number(project.task_done_count || 0);
        const overdue = Number(project.overdue_task_count || 0);
        const blocked = Number(project.blocked_task_count || 0);
        const total = Number(project.task_count || 0);
        const progress = total ? Math.round((done / total) * 100) : 0;
        const health = total > 0 && done === total
          ? { label: "Complete", tone: "complete", rank: 3 }
          : blocked > 0 || overdue > 0
            ? { label: "At risk", tone: "danger", rank: 0 }
            : total > 0
              ? { label: "On track", tone: "success", rank: 1 }
              : { label: "No tasks", tone: "neutral", rank: 2 };
        return { ...project, progress, health: health.label, healthTone: health.tone, healthRank: health.rank };
      })
      .sort((a, b) => a.healthRank - b.healthRank);

    const eventKeys = new Set(events.map((event) => {
      const time = wallDate(event.start_time, timeZone);
      return `${String(event.title || "").trim().toLowerCase()}-${toLocalDateStr(time)}-${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
    }));
    const distinctBlocks = blocks.filter((block) => {
      const duplicateKey = `${String(block.title || "").trim().toLowerCase()}-${todayKey}-${String(block.start_time || "").slice(0, 5)}`;
      return !eventKeys.has(duplicateKey);
    });

    const weeklyDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const key = toLocalDateStr(date);
      const counts = weeklyTaskMap.get(key) || {};
      const open = Number(counts.open || 0);
      const done = Number(counts.done || 0);
      const calendarCount = getEventsForDay(events, date, timeZone).length + (key === todayKey ? distinctBlocks.length : 0);
      return {
        key,
        label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
        open,
        done,
        events: calendarCount,
        total: open + done + calendarCount,
        isPast: key < todayKey,
        title: `${date.toLocaleDateString("en-US", { weekday: "long" })}: ${open} open, ${done} done, ${calendarCount} on the calendar`,
      };
    });
    const weeklySummary = weeklyDays.reduce(
      (summary, day) => ({ due: summary.due + day.open + day.done, done: summary.done + day.done, events: summary.events + day.events }),
      { due: 0, done: 0, events: 0 }
    );

    const toMinutes = (value) => {
      const [hours, minutes] = String(value || "00:00").slice(0, 5).split(":").map(Number);
      return { hours: hours || 0, minutes: minutes || 0 };
    };
    const blockItems = distinctBlocks.map((block, index) => {
      const start = toMinutes(block.start_time);
      const end = toMinutes(block.end_time || block.start_time);
      try {
        const pad = (n) => String(n).padStart(2, "0");
        return {
          key: `routine-${block.id || index}`,
          kind: "routine",
          dateKey: todayKey,
          title: block.title,
          whenLabel: formatClock(block.start_time),
          sourceLabel: "Day plan",
          timestamp: zonedInputToDate(`${todayKey}T${pad(start.hours)}:${pad(start.minutes)}`, timeZone).getTime(),
          endTimestamp: zonedInputToDate(`${todayKey}T${pad(end.hours)}:${pad(end.minutes)}`, timeZone).getTime(),
          href: "/routines",
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    const eventItems = events
      .filter((event) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time || event.start_time);
        if (event.all_day) {
          return (event.end_date || dateKey(end, "UTC")) > todayKey && (event.start_date || dateKey(start, "UTC")) < toLocalDateStr(upcomingEnd);
        }
        return end > wallDateToInstant(todayStart, timeZone) && start < wallDateToInstant(upcomingEnd, timeZone);
      })
      .map((event) => {
        const key = event.all_day ? event.start_date || dateKey(event.start_time, "UTC") : dateKey(event.start_time, timeZone);
        return {
          key: `event-${event.id}`,
          kind: "event",
          dateKey: key < todayKey ? todayKey : key,
          title: event.title,
          whenLabel: event.all_day ? "All day" : formatClock(event.start_time, timeZone),
          sourceLabel: event.project_name || "Calendar",
          color: getEventDisplayColor(event, "#3346d3"),
          timestamp: event.all_day ? wallDateToInstant(todayStart, timeZone).getTime() : new Date(event.start_time).getTime(),
          endTimestamp: event.all_day ? Number.MAX_SAFE_INTEGER : new Date(event.end_time || event.start_time).getTime(),
          href: "/calendar",
        };
      });

    const taskItems = upcomingTasks
      .filter((task) => {
        const key = valueDateKey(task.due_date);
        return key >= todayKey && key < toLocalDateStr(upcomingEnd);
      })
      .map((task) => ({
        key: `task-${task.id}`,
        kind: "task",
        dateKey: valueDateKey(task.due_date),
        title: task.title,
        whenLabel: "Due",
        sourceLabel: task.project_name || "Personal",
        timestamp: new Date(`${valueDateKey(task.due_date)}T23:59:00`).getTime(),
        endTimestamp: new Date(`${valueDateKey(task.due_date)}T23:59:59`).getTime(),
        href: `/tasks?task_id=${task.id}`,
      }));

    const allItems = [...blockItems, ...eventItems, ...taskItems].sort((a, b) => a.timestamp - b.timestamp);
    const todayItems = allItems.filter((item) => item.dateKey === todayKey);
    const groups = new Map();
    for (const item of allItems) {
      if (item.dateKey === todayKey) continue;
      if (!groups.has(item.dateKey)) groups.set(item.dateKey, []);
      groups.get(item.dateKey).push(item);
    }
    const tomorrowKey = toLocalDateStr(new Date(todayStart.getTime() + DAY_MS));
    const laterGroups = [...groups.entries()].slice(0, 4).map(([key, items]) => ({
      key,
      label: key === tomorrowKey
        ? "Tomorrow"
        : new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" }),
      items: items.slice(0, 4),
    }));

    return {
      metrics,
      attentionTasks,
      projectHealth,
      weeklyDays,
      weeklySummary,
      todayItems,
      laterGroups,
      eventsToday: todayItems.filter((item) => item.kind === "event").length,
    };
  }, [overview, todayKey, todayStart, upcomingEnd, weekStart, timeZone]);

  const firstName = (user?.full_name || user?.email?.split("@")[0] || "there").trim().split(/\s+/)[0];
  const localNow = wallDate(now, timeZone);
  const attentionCount = Number(viewModel.metrics.attentionCount || viewModel.attentionTasks.length || 0);
  const dueToday = Number(viewModel.metrics.dueToday || 0);
  const { Icon: PhaseIcon, tone: phaseTone } = dayPhaseIcon(localNow);

  return (
    <>
      <MorningReviewModal />
      <div className="page max-w-[72rem]">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="stagger min-w-0">
            <p className="text-overline flex items-center gap-2">
              <PhaseIcon className={cn("h-3.5 w-3.5", phaseTone)} strokeWidth={2} aria-hidden="true" />
              {localNow.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-display mt-3">
              {greetingFor(localNow)}, <em className="italic">{firstName}</em>.
            </h1>
            <p className="mt-3 max-w-xl text-[1rem] text-muted">
              {isLoading ? "Gathering your day…" : summarySentence({ attention: attentionCount, dueToday, eventsToday: viewModel.eventsToday })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Sparkles />}
              onClick={() => window.dispatchEvent(new CustomEvent("optimus-open-assistant", {
                detail: { prompt: "What's on my plate today?" },
              }))}
              title="Ask the assistant what's on your plate today"
            >
              Ask about today
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Plus />}
              onClick={() => window.dispatchEvent(new Event("optimus-open-quick-capture"))}
            >
              New
            </Button>
          </div>
        </header>

        <DayProgress timeZone={timeZone} className="mb-10" />

        <PlanDayPrompt timeZone={timeZone} />

        {error && (
          <ErrorState
            compact
            className="mb-8"
            title="Today couldn't be refreshed"
            description="Your data is safe. Check the connection and try again."
            onRetry={refetch}
          />
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] lg:gap-8">
          <div className="stagger space-y-10">
            <Agenda
              todayItems={viewModel.todayItems}
              laterGroups={viewModel.laterGroups}
              loading={isLoading}
              nowTimestamp={now.getTime()}
              nowLabel={formatClock(now.toISOString(), timeZone)}
            />
            <AttentionList
              items={viewModel.attentionTasks}
              total={attentionCount}
              loading={isLoading}
              todayStart={todayStart}
            />
          </div>
          <aside className="stagger space-y-10">
            <TodayRoutines />
            <ProjectPulse projects={viewModel.projectHealth} loading={isLoading} />
            <WeekStrip
              days={viewModel.weeklyDays}
              summary={viewModel.weeklySummary}
              loading={isLoading}
              todayKey={todayKey}
            />
          </aside>
        </div>

        {!isLoading && overview && (
          <p className="mt-14 flex items-center gap-1.5 text-xs text-placeholder">
            <Link href="/tasks" className="inline-flex items-center gap-1 hover:text-heading">
              {Number(viewModel.metrics.openTasks || 0)} open tasks across your workspace <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
