"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FolderKanban,
  ListTodo,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { toLocalDateStr } from "@/lib/utils";
import ProjectModal from "@/components/projects/ProjectModal";
import MorningReviewModal from "@/components/dashboard/MorningReviewModal";
import DashboardActionLauncher from "@/components/dashboard/DashboardActionLauncher";
import { ErrorState } from "@/components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;
const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

function valueDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toLocalDateStr(date);
}

function relativeDateLabel(value, todayStart) {
  const key = valueDateKey(value);
  if (!key) return "No due date";
  const date = new Date(`${key}T00:00:00`);
  const diff = Math.round((date - todayStart) / DAY_MS);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatClock(value) {
  if (!value) return "All day";
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
    const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "All day";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function comparisonLabel(current = 0, previous = 0) {
  const difference = Number(current || 0) - Number(previous || 0);
  if (difference === 0) return "Same as last week";
  return `${difference > 0 ? "+" : ""}${difference} from last week`;
}

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function attentionMeta(task, todayStart) {
  const dueKey = valueDateKey(task.due_date);
  const todayKey = toLocalDateStr(todayStart);

  if (dueKey && dueKey < todayKey) {
    return { label: "Overdue", tone: "danger", score: 0 };
  }
  if (Number(task.blocking_count) > 0) {
    return { label: "Blocked", tone: "danger", score: 1 };
  }
  if (task.status === "on_hold") {
    return { label: "On hold", tone: "warning", score: 2 };
  }
  if (task.priority === "urgent") {
    return { label: "Urgent", tone: "danger", score: 3 };
  }
  if (task.priority === "high") {
    return { label: "High priority", tone: "warning", score: 4 };
  }
  return null;
}

function priorityLabel(priority) {
  if (!priority || priority === "medium") return "";
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
}

function focusReason(task, meta) {
  if (meta.label === "Overdue") return "This task has passed its due date. Move it forward or give it a realistic new date.";
  if (meta.label === "Blocked") {
    const blockers = Number(task.blocking_count || 0);
    return `${blockers} unfinished ${blockers === 1 ? "dependency is" : "dependencies are"} preventing progress.`;
  }
  if (meta.label === "On hold") return "This task is paused. Review it now and decide the next concrete step.";
  if (meta.label === "Urgent") return "This urgent task is the strongest signal in your workspace right now.";
  return "This high-priority task is the best place to direct your attention next.";
}

function PanelHeading({ eyebrow, title, helper, href, actionLabel = "View all" }) {
  return (
    <div className="focus-panel-heading">
      <div>
        {eyebrow && <p>{eyebrow}</p>}
        <h2>{title}</h2>
        {helper && <span>{helper}</span>}
      </div>
      {href && (
        <Link href={href} className="focus-text-link">
          {actionLabel} <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function StatusStrip({ metrics, loading }) {
  const items = [
    {
      label: "Today",
      value: Number(metrics.dueToday || 0) > 0 ? `${metrics.dueToday} due` : "Clear",
      detail: Number(metrics.dueToday || 0) > 0 ? "Open today's tasks" : "No deadlines today",
      href: "/tasks",
      icon: CalendarDays,
      tone: Number(metrics.dueToday || 0) > 0 ? "attention" : "success",
    },
    {
      label: "Open work",
      value: String(metrics.openTasks || 0),
      detail: "Across your workspace",
      href: "/tasks",
      icon: ListTodo,
      tone: "default",
    },
    {
      label: "Projects",
      value: `${metrics.activeProjects || 0} active`,
      detail: `${metrics.totalProjects || 0} total projects`,
      href: "/projects",
      icon: FolderKanban,
      tone: "default",
    },
    {
      label: "Momentum",
      value: `${metrics.tasksCompletedThisWeek || 0} done`,
      detail: comparisonLabel(metrics.tasksCompletedThisWeek, metrics.tasksCompletedLastWeek),
      href: "/tasks",
      icon: TrendingUp,
      tone: "default",
    },
  ];

  return (
    <section className="focus-status-strip" aria-label="Workspace summary">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link href={item.href} className={`focus-status-item focus-status-${item.tone}`} key={item.label}>
            <span className="focus-status-icon"><Icon aria-hidden="true" /></span>
            <span className="focus-status-copy">
              <small>{item.label}</small>
              <strong>{loading ? "—" : item.value}</strong>
              <em>{item.detail}</em>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
        );
      })}
    </section>
  );
}

function FocusHero({ tasks, attentionCount, loading, todayStart, nextItem }) {
  const first = tasks[0];

  if (loading) {
    return (
      <article className="focus-hero focus-hero-loading">
        <span className="focus-loading-line focus-loading-short" />
        <span className="focus-loading-line focus-loading-title" />
        <span className="focus-loading-line" />
        <span className="focus-loading-line focus-loading-medium" />
      </article>
    );
  }

  if (!first) {
    return (
      <article className="focus-hero focus-hero-clear">
        <div className="focus-hero-clear-icon"><CheckCircle2 aria-hidden="true" /></div>
        <div className="focus-hero-clear-copy">
          <p className="focus-eyebrow">Focus now</p>
          <h2>You&apos;re clear for now</h2>
          <p>
            {nextItem
              ? `Nothing urgent is waiting. Your next scheduled item is ${nextItem.title}.`
              : "Nothing urgent is waiting. This is a good moment to choose one meaningful next step."}
          </p>
          <div className="focus-hero-actions">
            <Link href={nextItem?.href || "/tasks"} className="focus-button focus-button-primary">
              {nextItem ? "Open next item" : "Choose a task"} <ArrowRight aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="focus-button focus-button-secondary"
              onClick={() => window.dispatchEvent(new Event("optimus-open-review"))}
            >
              Plan my day
            </button>
          </div>
        </div>
      </article>
    );
  }

  const { task, meta } = first;
  const extraCount = Math.max(0, Number(attentionCount || tasks.length) - 1);
  const priority = priorityLabel(task.priority);

  return (
    <article className={`focus-hero focus-hero-${meta.tone}`}>
      <div className="focus-hero-topline">
        <p className="focus-eyebrow"><span /> Focus now</p>
        <Link href="/tasks" className="focus-text-link focus-hero-queue-link">
          Priority queue <ChevronRight aria-hidden="true" />
        </Link>
      </div>
      <div className="focus-hero-body">
        <div className="focus-hero-copy">
          <h2>{attentionCount === 1 ? "1 thing needs your attention" : `${attentionCount} things need your attention`}</h2>
          <div className="focus-hero-badges">
            <span className={`focus-badge focus-badge-${meta.tone}`}><AlertTriangle aria-hidden="true" />{meta.label}</span>
            {priority && <span className="focus-badge focus-badge-neutral">{priority}</span>}
          </div>
          <h3>{task.title}</h3>
          <p className="focus-hero-meta">{task.project_name || "Personal task"} · {relativeDateLabel(task.due_date, todayStart)}</p>
          <p className="focus-hero-reason">{focusReason(task, meta)}</p>
          <div className="focus-hero-actions">
            <Link href={`/tasks?task_id=${task.id}`} className="focus-button focus-button-primary">
              Open task <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/tasks" className="focus-button focus-button-secondary">View queue</Link>
          </div>
        </div>
        <aside className="focus-hero-signal" aria-label="Priority summary">
          <span>Priority signal</span>
          <strong>{String(attentionCount || 1).padStart(2, "0")}</strong>
          <p>{extraCount > 0 ? `${extraCount} more ${extraCount === 1 ? "item" : "items"} waiting` : "Your single next decision"}</p>
        </aside>
      </div>
    </article>
  );
}

function SchedulePanel({ items, loading }) {
  const icons = { task: ListTodo, event: CalendarDays, routine: Clock3 };

  return (
    <article className="focus-schedule-panel">
      <PanelHeading
        eyebrow="Your day"
        title="Today & upcoming"
        helper="Your next commitments, in order"
        href="/calendar"
        actionLabel="Calendar"
      />
      <div className="focus-schedule-list">
        {loading ? (
          <div className="focus-panel-empty">Building your schedule…</div>
        ) : items.length ? items.slice(0, 4).map((item, index) => {
          const Icon = icons[item.kind] || CircleDot;
          return (
            <Link href={item.href} className={`focus-schedule-row ${index === 0 ? "focus-schedule-row-next" : ""}`} key={item.key}>
              <span className="focus-schedule-time">
                <strong>{item.whenLabel}</strong>
                <small>{item.dayLabel}</small>
              </span>
              <span className="focus-timeline-mark">
                <i><Icon aria-hidden="true" /></i>
              </span>
              <span className="focus-schedule-copy">
                {index === 0 && <em>Up next</em>}
                <strong>{item.title}</strong>
                <small>{item.sourceLabel}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </Link>
          );
        }) : (
          <div className="focus-panel-empty focus-panel-empty-spacious">
            <CalendarDays aria-hidden="true" />
            <strong>Your next seven days are open</strong>
            <span>Add a dated task or calendar event when you&apos;re ready.</span>
          </div>
        )}
      </div>
      {!loading && items.length > 0 && items.length < 3 && (
        <div className="focus-open-space"><CheckCircle2 aria-hidden="true" /><span><strong>Open space ahead</strong>No other dated work in the next seven days.</span></div>
      )}
    </article>
  );
}

function ProjectHealthPanel({ projects, loading }) {
  return (
    <article className="focus-project-panel">
      <PanelHeading
        eyebrow="Delivery"
        title="Project health"
        helper="Progress, blockers and delivery risk"
        href="/projects"
      />
      <div className="focus-project-list">
        {loading ? (
          <div className="focus-panel-empty">Reviewing active projects…</div>
        ) : projects.length ? projects.slice(0, 3).map((project) => (
          <div className="focus-project-row" key={project.id}>
            <div className="focus-project-topline">
              <span className="focus-project-identity">
                <i className="focus-project-mark" style={{ "--project-color": project.color || "#8438d7" }}>
                  <FolderKanban aria-hidden="true" />
                </i>
                <span><strong>{project.name}</strong><small>{project.healthReason}</small></span>
              </span>
              <span className={`focus-health focus-health-${project.healthTone}`}>{project.health}</span>
            </div>
            <div className="focus-project-progress-row">
              <span className="focus-project-percent"><strong>{project.progress}%</strong><small>complete</small></span>
              <span className="focus-project-progress"><i style={{ width: `${project.progress}%` }} /></span>
            </div>
            <div className="focus-project-footer">
              <span className="focus-project-counts">
                <em><strong>{project.done}</strong> completed</em>
                <em><strong>{project.active}</strong> active</em>
                <em className={project.blocked > 0 ? "focus-project-count-risk" : ""}><strong>{project.blocked}</strong> blocked</em>
              </span>
              <Link href={`/projects?project_id=${project.id}`} className="focus-inline-action">
                Open project <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        )) : (
          <div className="focus-panel-empty focus-panel-empty-spacious">
            <FolderKanban aria-hidden="true" />
            <strong>No active projects yet</strong>
            <span>Create a project to start tracking delivery health.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function lightWeekCopy(summary, totalLoad) {
  if (totalLoad === 0) return "Your week is open. Choose one meaningful priority and give it a place on the calendar.";
  if (summary.due === 0 && summary.events === 1) return "You have one scheduled commitment and no tasks due. A good week to move one priority forward.";
  if (summary.due === 0) return `You have ${summary.events} scheduled commitments and no tasks due. There is room to make progress.`;
  return `Only ${totalLoad} items are scheduled. Your week has enough space for one focused priority.`;
}

function WeeklyInsightPanel({ days, summary, loading }) {
  const maxLoad = Math.max(0, ...days.map((day) => day.total));
  const totalLoad = summary.due + summary.events;
  const chartScale = Math.max(4, maxLoad);
  const showChart = totalLoad > 3;
  const activeDays = days.filter((day) => day.total > 0);

  return (
    <article className="focus-week-panel">
      <PanelHeading
        eyebrow="Capacity"
        title="This week"
        helper="Tasks due and calendar commitments"
        href="/tasks"
        actionLabel="Tasks"
      />
      {loading ? (
        <div className="focus-panel-empty">Calculating this week&apos;s load…</div>
      ) : showChart ? (
        <>
          <div className="focus-week-summary-line">
            <span><strong>{totalLoad <= 8 ? "Balanced week" : "Busy week"}</strong><small>{totalLoad} scheduled items</small></span>
            <span className="focus-week-legend"><i />Tasks <i />Calendar</span>
          </div>
          <div className="focus-week-chart" aria-label="Items due and scheduled this week">
            {days.map((day) => {
              const height = day.total ? Math.max(12, Math.round((day.total / chartScale) * 100)) : 0;
              return (
                <div className="focus-week-day" key={day.key} title={day.title}>
                  <span className="focus-week-track">
                    {day.total > 0 && (
                      <i className={day.isPast && day.open > 0 ? "focus-week-fill focus-week-fill-risk" : "focus-week-fill"} style={{ height: `${height}%` }} />
                    )}
                  </span>
                  <strong>{day.total || "–"}</strong>
                  <small>{day.label}</small>
                </div>
              );
            })}
          </div>
          <div className="focus-week-stats">
            <span><strong>{summary.due}</strong><small>Tasks due</small></span>
            <span><strong>{summary.done}</strong><small>Done</small></span>
            <span><strong>{summary.events}</strong><small>Calendar</small></span>
          </div>
        </>
      ) : (
        <div className="focus-light-week">
          <span className="focus-light-week-icon"><Sparkles aria-hidden="true" /></span>
          <p className="focus-eyebrow">Light week</p>
          <h3>There is room to move something forward</h3>
          <p>{lightWeekCopy(summary, totalLoad)}</p>
          {activeDays.length > 0 && (
            <div className="focus-light-days">
              {activeDays.map((day) => <span key={day.key}><strong>{day.label}</strong>{day.total} scheduled</span>)}
            </div>
          )}
          <Link href="/tasks" className="focus-button focus-button-secondary focus-light-week-action">
            Choose a priority <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      )}
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    overview,
    error,
    isLoading,
    refetch,
    today: todayStart,
    weekStart,
    upcomingEnd,
  } = useDashboardOverview();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const todayKey = toLocalDateStr(todayStart);

  const viewModel = useMemo(() => {
    const metrics = overview?.metrics || {};
    const attentionSource = overview?.attentionTasks || [];
    const projects = overview?.projects || [];
    const events = overview?.events || [];
    const blocks = overview?.dayPlanBlocks || [];
    const upcomingTasks = overview?.upcomingTasks || [];
    const weeklyTaskMap = new Map((overview?.weeklyTasks || []).map((day) => [valueDateKey(day.due_date), day]));

    const attentionTasks = attentionSource
      .map((task) => ({ task, meta: attentionMeta(task, todayStart) }))
      .filter((item) => item.meta)
      .sort((a, b) => {
        if (a.meta.score !== b.meta.score) return a.meta.score - b.meta.score;
        const aDate = valueDateKey(a.task.due_date) || "9999-12-31";
        const bDate = valueDateKey(b.task.due_date) || "9999-12-31";
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return (priorityRank[a.task.priority] ?? 9) - (priorityRank[b.task.priority] ?? 9);
      });

    const projectHealth = projects.map((project) => {
      const done = Number(project.task_done_count || 0);
      const overdue = Number(project.overdue_task_count || 0);
      const blocked = Number(project.blocked_task_count || 0);
      const total = Number(project.task_count || 0);
      const active = Math.max(0, total - done - blocked);
      const nextDue = valueDateKey(project.next_due_date) || "9999-12-31";
      const progress = total ? Math.round((done / total) * 100) : 0;
      const riskReasons = [
        blocked > 0 ? `${blocked} blocked task${blocked === 1 ? "" : "s"}` : "",
        overdue > 0 ? `${overdue} overdue task${overdue === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      const health = total > 0 && done === total
        ? { label: "Complete", tone: "complete", rank: 3, reason: `All ${total} tasks complete` }
        : riskReasons.length > 0
          ? { label: "At risk", tone: "danger", rank: 0, reason: riskReasons.join(" · ") }
          : total > 0
            ? { label: "On track", tone: "success", rank: 1, reason: `${total - done} task${total - done === 1 ? "" : "s"} remaining` }
            : { label: "No tasks", tone: "neutral", rank: 2, reason: "No tasks added" };
      return {
        ...project,
        total,
        done,
        active,
        blocked,
        overdue,
        progress,
        health: health.label,
        healthTone: health.tone,
        healthRank: health.rank,
        healthReason: health.reason,
        nextDue,
      };
    }).sort((a, b) => a.healthRank - b.healthRank || a.nextDue.localeCompare(b.nextDue));

    const eventKeys = new Set(events.map((event) => {
      const time = new Date(event.start_time);
      const hours = String(time.getHours()).padStart(2, "0");
      const minutes = String(time.getMinutes()).padStart(2, "0");
      return `${String(event.title || "").trim().toLowerCase()}-${toLocalDateStr(time)}-${hours}:${minutes}`;
    }));
    const distinctDayPlanBlocks = blocks.filter((block) => {
      const duplicateKey = `${String(block.title || "").trim().toLowerCase()}-${todayKey}-${String(block.start_time || "").slice(0, 5)}`;
      return !eventKeys.has(duplicateKey);
    });

    const weeklyDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const key = toLocalDateStr(date);
      const taskCounts = weeklyTaskMap.get(key) || {};
      const open = Number(taskCounts.open || 0);
      const done = Number(taskCounts.done || 0);
      const calendarCount = events.filter((event) => valueDateKey(new Date(event.start_time)) === key).length
        + (key === todayKey ? distinctDayPlanBlocks.length : 0);
      return {
        key,
        label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
        open,
        done,
        events: calendarCount,
        total: open + done + calendarCount,
        isPast: key < todayKey,
        title: `${date.toLocaleDateString("en-US", { weekday: "long" })}: ${open} open, ${done} done, ${calendarCount} calendar`,
      };
    });

    const weeklySummary = weeklyDays.reduce((summary, day) => ({
      due: summary.due + day.open + day.done,
      done: summary.done + day.done,
      events: summary.events + day.events,
    }), { due: 0, done: 0, events: 0 });

    const dayPlanItems = distinctDayPlanBlocks.map((block, index) => {
      const [hours, minutes] = String(block.start_time || "00:00").slice(0, 5).split(":").map(Number);
      const timestamp = new Date(todayStart).setHours(hours || 0, minutes || 0, 0, 0);
      return {
        key: `routine-${block.id || index}`,
        kind: "routine",
        title: block.title,
        whenLabel: formatClock(block.start_time),
        dayLabel: "Today",
        sourceLabel: "Day plan",
        timestamp,
        href: "/habits",
      };
    });
    const eventItems = events.filter((event) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time || event.start_time);
      return end >= todayStart && start < upcomingEnd;
    }).map((event) => ({
      key: `event-${event.id}`,
      kind: "event",
      title: event.title,
      whenLabel: event.all_day ? "All day" : formatClock(event.start_time),
      dayLabel: valueDateKey(new Date(event.start_time)) === todayKey
        ? "Today"
        : relativeDateLabel(event.start_time, todayStart).replace("Due ", ""),
      sourceLabel: event.project_name || "Calendar event",
      timestamp: new Date(event.start_time).getTime(),
      href: "/calendar",
    }));
    const taskItems = upcomingTasks.filter((task) => {
      const key = valueDateKey(task.due_date);
      return key >= todayKey && key < toLocalDateStr(upcomingEnd);
    }).map((task) => ({
      key: `task-${task.id}`,
      kind: "task",
      title: task.title,
      whenLabel: relativeDateLabel(task.due_date, todayStart).replace("Due ", ""),
      dayLabel: task.priority === "urgent" ? "Urgent task" : "Dated task",
      sourceLabel: task.project_name || "Personal task",
      timestamp: new Date(`${valueDateKey(task.due_date)}T23:59:00`).getTime(),
      href: `/tasks?task_id=${task.id}`,
    }));

    return {
      metrics,
      attentionTasks,
      projectHealth,
      weeklyDays,
      weeklySummary,
      upcomingItems: [...dayPlanItems, ...eventItems, ...taskItems].sort((a, b) => a.timestamp - b.timestamp),
    };
  }, [overview, todayKey, todayStart, upcomingEnd, weekStart]);

  const firstName = (user?.full_name || user?.email?.split("@")[0] || "there").trim().split(/\s+/)[0];
  const now = new Date();
  const attentionCount = Number(viewModel.metrics.attentionCount || 0);
  const dueToday = Number(viewModel.metrics.dueToday || 0);
  const activeProjects = Number(viewModel.metrics.activeProjects || 0);
  const firstAttention = viewModel.attentionTasks[0]?.task;

  return (
    <>
      <MorningReviewModal />
      <div className="focus-dashboard">
        <header className="focus-dashboard-header">
          <div className="focus-header-copy">
            <p>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            <h1>{greetingFor(now)}, <span>{firstName}</span></h1>
            <div className="focus-live-summary" aria-label="Current workspace status">
              <span className={attentionCount > 0 ? "focus-live-attention" : ""}>
                <i />{attentionCount > 0 ? `${attentionCount} needs attention` : "No blockers"}
              </span>
              <span><i />{dueToday > 0 ? `${dueToday} due today` : "Today is clear"}</span>
              <span><i />{activeProjects} active {activeProjects === 1 ? "project" : "projects"}</span>
            </div>
          </div>
          <div className="focus-header-actions">
            {firstAttention && (
              <Link href={`/tasks?task_id=${firstAttention.id}`} className="focus-next-priority">
                <span><small>Next priority</small><strong>{firstAttention.title}</strong></span>
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              className="focus-button focus-button-secondary focus-plan-button"
              onClick={() => window.dispatchEvent(new Event("optimus-open-review"))}
            >
              <Sparkles aria-hidden="true" /> Plan my day
            </button>
          </div>
        </header>

        {error && (
          <ErrorState
            compact
            title="Dashboard data could not be refreshed"
            description="Your existing data is preserved. Check the connection and try again."
            onRetry={refetch}
          />
        )}

        <section className="focus-primary-grid" aria-label="Immediate priorities and schedule">
          <FocusHero
            tasks={viewModel.attentionTasks}
            attentionCount={attentionCount}
            loading={isLoading}
            todayStart={todayStart}
            nextItem={viewModel.upcomingItems[0]}
          />
          <SchedulePanel items={viewModel.upcomingItems} loading={isLoading} />
        </section>

        <StatusStrip metrics={viewModel.metrics} loading={isLoading} />

        <section className="focus-secondary-grid" aria-label="Project delivery and weekly capacity">
          <ProjectHealthPanel projects={viewModel.projectHealth} loading={isLoading} />
          <WeeklyInsightPanel days={viewModel.weeklyDays} summary={viewModel.weeklySummary} loading={isLoading} />
        </section>
      </div>

      <DashboardActionLauncher onAddProject={() => setProjectModalOpen(true)} />

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
      />
    </>
  );
}
