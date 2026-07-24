"use client";

import { cn, toLocalDateStr } from "@/lib/utils";
import { Badge } from "@/components/ui";

const priorityConfig = {
  urgent: { color: "bg-red-500", text: "text-red-400", label: "Urgent" },
  high: { color: "bg-amber-500", text: "text-amber-400", label: "High" },
  medium: { color: "bg-blue-500", text: "text-blue-400", label: "Medium" },
  low: { color: "bg-neutral-400", text: "text-muted", label: "Low" },
};

function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5m-15 12h13.5A1.5 1.5 0 0020.25 18.75V6.75a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v12a1.5 1.5 0 001.5 1.5z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M3.5 2.75A.75.75 0 014.25 2h10.5a.75.75 0 01.53 1.28L13.06 5.5l2.22 2.22A.75.75 0 0114.75 9H5v7.25a.75.75 0 01-1.5 0V2.75z" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h11.25M9 12h11.25M9 17.25h11.25M3.75 6.75l1.5 1.5 2.25-3M3.75 12l1.5 1.5 2.25-3M3.75 17.25l1.5 1.5 2.25-3" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992m0 0V4.356m0 4.992l-3.181-3.183a8.25 8.25 0 00-13.803 3.7M7.977 14.652H2.985m0 0v4.992m0-4.992l3.181 3.183a8.25 8.25 0 0013.803-3.7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 10.5h10.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 12.75v6A2.25 2.25 0 006.75 21z" />
    </svg>
  );
}

function formatCardDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function TaskScopeBadge({ task }) {
  if (!task.project_name) {
    return <Badge variant="neutral" size="sm" className="bg-surface-tertiary text-muted">Personal</Badge>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Badge variant="info" size="sm" className="shrink-0">Shared</Badge>
      <span
        className="min-w-0 truncate rounded-full px-2 py-px text-[0.6875rem] font-medium leading-4"
        style={{
          backgroundColor: `${task.project_color || "#0d6b88"}20`,
          color: task.project_color || "#818cf8",
        }}
      >
        {task.project_name}
      </span>
    </div>
  );
}

function OwnerPill({ task, currentUserId }) {
  const isMine = currentUserId && task.user_id === currentUserId;
  const label = isMine ? "You" : task.project_name ? "Member" : "Owner";

  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[0.625rem] font-semibold leading-none",
        isMine
          ? "border-brand-500/30 bg-brand-500/10 text-brand-300"
          : "border-border bg-surface-tertiary text-muted"
      )}
      title={label}
    >
      {isMine ? "Y" : "M"}
    </span>
  );
}

function MetadataItem({ icon, children, className, title }) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1 text-caption leading-4", className)}
      title={title}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default function TaskCard({ task, onClick, isDragging, currentUserId }) {
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const isDone = task.status === "done";
  const isOverdue = task.due_date && toLocalDateStr(task.due_date) < toLocalDateStr() && !isDone;
  const hasSubtasks = Number(task.subtask_count || 0) > 0;
  const hasBlockers = Number(task.blocking_count || 0) > 0;

  return (
    <article
      onClick={() => onClick?.(task)}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border border-border-light bg-surface p-3 shadow-xs transition-all duration-150 hover:border-border-strong hover:bg-surface-raised/80 hover:shadow-card",
        isDragging && "opacity-50 shadow-lg",
        isDone && "opacity-75"
      )}
    >
      <span className={cn("absolute left-0 top-0 h-full w-1", priority.color)} />

      <div className="flex items-start gap-2.5 pl-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                "min-w-0 text-body-sm font-semibold text-heading! leading-5",
                isDone && "line-through text-muted!"
              )}
            >
              {task.title}
            </h4>
            <OwnerPill task={task} currentUserId={currentUserId} />
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <TaskScopeBadge task={task} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5">
            {task.due_date && (
              <MetadataItem
                icon={<CalendarIcon />}
                className={cn(isOverdue && "text-danger! font-medium")}
                title={isOverdue ? "Overdue" : "Due date"}
              >
                {formatCardDate(task.due_date)}
              </MetadataItem>
            )}

            <MetadataItem icon={<FlagIcon />} className={priority.text} title="Priority">
              {priority.label}
            </MetadataItem>

            {hasSubtasks && (
              <MetadataItem icon={<ChecklistIcon />} title="Subtasks">
                {task.subtask_done_count || 0}/{task.subtask_count}
              </MetadataItem>
            )}

            {task.recurrence_rule && (
              <MetadataItem icon={<RepeatIcon />} className="text-brand-400" title={`Repeats ${task.recurrence_rule}`}>
                {task.recurrence_rule}
              </MetadataItem>
            )}

            {hasBlockers && (
              <MetadataItem icon={<LockIcon />} className="text-amber-400" title={`Blocked by ${task.blocking_count} task(s)`}>
                blocked
              </MetadataItem>
            )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex max-w-full items-center truncate rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium leading-3"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-caption">+{task.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
