"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FolderKanban,
  ListTodo,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { toLocalDateStr } from "@/lib/utils";
import ProjectModal from "@/components/projects/ProjectModal";
import MorningReviewModal from "@/components/dashboard/MorningReviewModal";
import DashboardActionLauncher from "@/components/dashboard/DashboardActionLauncher";

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

function SectionHeader({ eyebrow, title, helper, href, actionLabel = "View all" }) {
  return (
    <div className="saas-card-header">
      <div>
        {eyebrow && <p>{eyebrow}</p>}
        <h2>{title}</h2>
        {helper && <span>{helper}</span>}
      </div>
      {href && (
        <Link href={href} className="saas-text-link">
          {actionLabel} <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function MetricCard({ label, value, helper, href, tone = "default", loading = false }) {
  return (
    <Link href={href} className={`saas-metric-card saas-metric-${tone}`}>
      <span>{label}</span>
      <strong>{loading ? "—" : value}</strong>
      <p>{helper}<ChevronRight aria-hidden="true" /></p>
    </Link>
  );
}

function AttentionCard({ tasks, loading, todayStart }) {
  return (
    <article className="saas-card saas-attention-card">
      <SectionHeader
        eyebrow="Priority queue"
        title="Attention needed"
        helper="Overdue, blocked and high-priority work"
        href="/tasks"
      />
      <div className="saas-attention-list">
        {loading ? (
          <div className="saas-empty-state">Checking your priority queue…</div>
        ) : tasks.length ? tasks.slice(0, 5).map(({ task, meta }) => (
          <Link href={`/tasks?task_id=${task.id}`} className="saas-attention-row" key={task.id}>
            <span className={`saas-row-icon saas-row-icon-${meta.tone}`}>
              <AlertTriangle aria-hidden="true" />
            </span>
            <span className="saas-row-copy">
              <strong>{task.title}</strong>
              <small>{task.project_name || "Personal task"} · {relativeDateLabel(task.due_date, todayStart)}</small>
            </span>
            <span className={`saas-status saas-status-${meta.tone}`}>{meta.label}</span>
            <ChevronRight className="saas-row-chevron" aria-hidden="true" />
          </Link>
        )) : (
          <div className="saas-empty-state saas-empty-success">
            <CheckCircle2 aria-hidden="true" />
            <strong>No urgent work is waiting</strong>
            <span>New overdue or blocked tasks will surface here.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function UpcomingCard({ items, loading }) {
  const icons = { task: ListTodo, event: CalendarDays, routine: Clock3 };

  return (
    <article className="saas-card saas-upcoming-card">
      <SectionHeader
        eyebrow="Your day"
        title="Today & upcoming"
        helper="The next items on your calendar"
        href="/calendar"
        actionLabel="Calendar"
      />
      <div className="saas-upcoming-list">
        {loading ? (
          <div className="saas-empty-state">Building your schedule…</div>
        ) : items.length ? (
          <>
            {items.slice(0, 5).map((item) => {
              const Icon = icons[item.kind] || CircleDot;
              return (
                <Link href={item.href} className="saas-upcoming-row" key={item.key}>
                  <span className="saas-upcoming-when">
                    <strong>{item.whenLabel}</strong>
                    <small>{item.dayLabel}</small>
                  </span>
                  <span className={`saas-row-icon saas-row-icon-${item.kind}`}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="saas-row-copy">
                    <strong>{item.title}</strong>
                    <small>{item.sourceLabel}</small>
                  </span>
                  <ChevronRight className="saas-row-chevron" aria-hidden="true" />
                </Link>
              );
            })}
            {items.length < 3 && (
              <div className="saas-upcoming-note">
                <CheckCircle2 aria-hidden="true" />
                <span><strong>Open space ahead</strong><small>No other dated work in the next seven days.</small></span>
              </div>
            )}
          </>
        ) : (
          <div className="saas-empty-state">
            <CalendarDays aria-hidden="true" />
            <strong>Your next seven days are open</strong>
            <span>Add a dated task or calendar event when you are ready.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function ProjectHealthCard({ projects, loading }) {
  return (
    <article className="saas-card saas-project-health-card">
      <SectionHeader
        eyebrow="Delivery"
        title="Project health"
        helper="Active work ranked by delivery risk"
        href="/projects"
      />
      <div className="saas-project-list">
        {loading ? (
          <div className="saas-empty-state">Reviewing active projects…</div>
        ) : projects.length ? projects.slice(0, 4).map((project) => (
          <Link href={`/projects?project_id=${project.id}`} className="saas-project-row" key={project.id}>
            <span className="saas-project-mark" style={{ "--project-color": project.color || "#8438d7" }}>
              <FolderKanban aria-hidden="true" />
            </span>
            <span className="saas-project-copy">
              <span>
                <strong>{project.name}</strong>
                <small className={project.healthTone === "danger" ? "saas-project-detail-risk" : undefined}>
                  {project.healthDetail}
                </small>
              </span>
              <i><em style={{ width: `${project.progress}%` }} /></i>
            </span>
            <span
              className={`saas-health saas-health-${project.healthTone}`}
              title={project.healthReason || undefined}
            >
              {project.healthTone === "complete" && <CheckCircle2 aria-hidden="true" />}
              {project.health}
            </span>
            <strong className="saas-project-percent">{project.progress}%</strong>
          </Link>
        )) : (
          <div className="saas-empty-state">
            <FolderKanban aria-hidden="true" />
            <strong>No active projects yet</strong>
            <span>Create a project to begin tracking delivery health.</span>
          </div>
        )}
      </div>
    </article>
  );
}

function WeeklyLoadCard({ days, summary, loading }) {
  const maxLoad = Math.max(0, ...days.map((day) => day.total));
  const chartScale = Math.max(4, maxLoad);
  const totalLoad = summary.due + summary.events;

  return (
    <article className="saas-card saas-weekly-card">
      <SectionHeader
        eyebrow="Capacity"
        title="Weekly load"
        helper="Tasks due and calendar commitments"
        href="/tasks"
        actionLabel="Tasks"
      />
      {loading ? (
        <div className="saas-empty-state">Calculating this week’s load…</div>
      ) : maxLoad > 0 ? (
        <>
          <div className="saas-load-legend-row">
            <div className="saas-load-legend" aria-hidden="true">
              <span><i className="saas-legend-open" />Open due</span>
              <span><i className="saas-legend-done" />Done among due</span>
              <span><i className="saas-legend-event" />Calendar</span>
            </div>
            <span className="saas-load-density">
              {totalLoad <= 3 ? "Light week" : totalLoad <= 8 ? "Balanced week" : "Busy week"} · {totalLoad} scheduled
            </span>
          </div>
          <div className="saas-load-chart" aria-label="Items due and scheduled this week">
            {days.map((day) => {
              const height = day.total ? Math.max(14, Math.round((day.total / chartScale) * 100)) : 0;
              return (
                <div className="saas-load-day" key={day.key}>
                  <div className="saas-load-track">
                    {day.total > 0 && (
                      <div className="saas-load-fill" style={{ height: `${height}%` }} title={day.title}>
                        {day.events > 0 && <i className="saas-load-events" style={{ flex: day.events }} />}
                        {day.done > 0 && <i className="saas-load-done" style={{ flex: day.done }} />}
                        {day.open > 0 && <i className={day.isPast ? "saas-load-overdue" : "saas-load-open"} style={{ flex: day.open }} />}
                      </div>
                    )}
                  </div>
                  <span className="saas-load-count">{day.total || "–"}</span>
                  <strong>{day.label}</strong>
                </div>
              );
            })}
          </div>
          <div className="saas-weekly-summary">
            <span><strong>{summary.due}</strong><small>Tasks due</small></span>
            <span><strong>{summary.done}</strong><small>Done among due</small></span>
            <span><strong>{summary.events}</strong><small>Calendar items</small></span>
          </div>
        </>
      ) : (
        <div className="saas-empty-state saas-weekly-empty">
          <CheckCircle2 aria-hidden="true" />
          <strong>No scheduled load this week</strong>
          <span>Your workload chart will appear when work is dated.</span>
        </div>
      )}
    </article>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    overview,
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
        progress,
        health: health.label,
        healthTone: health.tone,
        healthRank: health.rank,
        healthReason: health.reason,
        healthDetail: total > 0 && done === total
          ? `${done}/${total} tasks complete`
          : total > 0
            ? `${done}/${total} complete · ${health.reason}`
            : health.reason,
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

  return (
    <>
      <MorningReviewModal />
      <div className="saas-dashboard">
        <header className="saas-page-header">
          <div>
            <p>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            <h1>{greetingFor(now)}, <span>{firstName}</span></h1>
            <small>Here’s what needs your attention today.</small>
          </div>
        </header>

        <section className="saas-metrics" aria-label="Operational summary">
          <MetricCard
            label="Needs attention"
            value={viewModel.metrics.attentionCount || 0}
            helper={viewModel.metrics.attentionCount ? "Review priority queue" : "Nothing urgent"}
            href="/tasks"
            tone={viewModel.metrics.attentionCount ? "attention" : "default"}
            loading={isLoading}
          />
          <MetricCard
            label="Due today"
            value={viewModel.metrics.dueToday || 0}
            helper={`${viewModel.metrics.openTasks || 0} open across workspace`}
            href="/tasks"
            loading={isLoading}
          />
          <MetricCard
            label="Active projects"
            value={viewModel.metrics.activeProjects || 0}
            helper={`${viewModel.metrics.totalProjects || 0} total projects`}
            href="/projects"
            loading={isLoading}
          />
          <MetricCard
            label="Done this week"
            value={viewModel.metrics.tasksCompletedThisWeek || 0}
            helper={comparisonLabel(viewModel.metrics.tasksCompletedThisWeek, viewModel.metrics.tasksCompletedLastWeek)}
            href="/tasks"
            loading={isLoading}
          />
        </section>

        <section className="saas-dashboard-grid" aria-label="Workspace operations">
          <div className="saas-dashboard-column saas-dashboard-column-primary">
            <AttentionCard tasks={viewModel.attentionTasks} loading={isLoading} todayStart={todayStart} />
            <ProjectHealthCard projects={viewModel.projectHealth} loading={isLoading} />
          </div>
          <div className="saas-dashboard-column saas-dashboard-column-secondary">
            <UpcomingCard items={viewModel.upcomingItems} loading={isLoading} />
            <WeeklyLoadCard days={viewModel.weeklyDays} summary={viewModel.weeklySummary} loading={isLoading} />
          </div>
        </section>
      </div>

      <DashboardActionLauncher onAddProject={() => setProjectModalOpen(true)} />

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSave={() => {
          refetch();
          setProjectModalOpen(false);
        }}
      />
    </>
  );
}
