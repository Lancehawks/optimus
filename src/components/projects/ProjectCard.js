"use client";

import { Badge } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

const statusBadge = {
  active: { variant: "success", label: "Active" },
  paused: { variant: "warning", label: "Paused" },
  completed: { variant: "default", label: "Completed" },
  archived: { variant: "neutral", label: "Archived" },
};

const typeLabels = {
  work: { label: "Work", icon: "💼" },
  learning: { label: "Learning", icon: "📚" },
  personal: { label: "Personal", icon: "🏠" },
};

function getDueDateWarning(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Overdue", className: "text-danger!" };
  if (diffDays <= 3) return { text: `${diffDays}d left`, className: "text-warning!" };
  if (diffDays <= 7) return { text: `${diffDays}d left`, className: "text-amber-500!" };
  return null;
}

export default function ProjectCard({ project, onClick, onDelete }) {
  const { variant, label } = statusBadge[project.status] || statusBadge.active;
  const taskCount = project.task_count || 0;
  const taskDone = project.task_done_count || 0;
  const progress = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
  const typeInfo = project.type ? typeLabels[project.type] : null;
  const dueDateWarning = project.status !== "completed" && project.status !== "archived"
    ? getDueDateWarning(project.end_date)
    : null;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete?.(project);
  };

  const handleCardKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(project);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(project)}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "optimus-project-card card card-hover p-5 border-l-4 text-left w-full cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
      )}
      style={{ borderLeftColor: project.color || "#0d6b88" }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <h3 className="min-w-0 flex-1 text-body text-heading! font-semibold line-clamp-1">{project.name}</h3>
          {/* Delete — only the project creator sees this */}
          {project.is_owner && (
            <button
              type="button"
              onClick={handleDeleteClick}
              title="Delete project"
              aria-label="Delete project"
              className="mt-[-2px] inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-danger-light hover:text-danger! focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 cursor-pointer transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0115.916 21.75H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
        <div className="shrink-0">
          <Badge variant={variant} size="sm">{label}</Badge>
        </div>
      </div>

      {/* Type */}
      {typeInfo && (
        <p className="text-caption mb-2">
          <span className="mr-1">{typeInfo.icon}</span>
          {typeInfo.label}
        </p>
      )}

      {project.description && (
        <p className="text-body-sm text-muted! line-clamp-2 mb-4">{project.description}</p>
      )}

      {/* Progress bar — always shown */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-caption mb-1.5">
          <span>{taskDone} of {taskCount} tasks</span>
          {taskCount > 0 && <span className="font-medium">{progress}%</span>}
        </div>
        <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: project.color || "#0d6b88",
            }}
          />
        </div>
      </div>

      {/* Date range + due date warning */}
      {(project.start_date || project.end_date) && (
        <div className="flex items-center justify-between">
          <p className="text-caption">
            {project.start_date && formatDate(project.start_date)}
            {project.start_date && project.end_date && " — "}
            {project.end_date && formatDate(project.end_date)}
          </p>
          {dueDateWarning && (
            <span className={cn("text-caption font-medium", dueDateWarning.className)}>
              {dueDateWarning.text}
            </span>
          )}
        </div>
      )}

      {/* Milestones count */}
      <div className="flex items-center justify-between gap-2 mt-1">
        {project.milestone_count > 0 ? (
          <p className="text-caption">
            {project.milestone_done_count}/{project.milestone_count} milestones
          </p>
        ) : (
          <span />
        )}
        {project.member_count > 1 && (
          <p className="text-caption">
            {project.member_count} members
          </p>
        )}
      </div>
    </div>
  );
}
