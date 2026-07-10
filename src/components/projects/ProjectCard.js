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

  const handleDeleteKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onDelete?.(project);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onClick(project)}
      className={cn(
        "card card-hover p-5 border-l-4 text-left w-full cursor-pointer transition-all"
      )}
      style={{ borderLeftColor: project.color || "#6366f1" }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-body text-heading! font-semibold line-clamp-1">{project.name}</h3>
          {/* Delete — only the project creator sees this */}
          {project.is_owner && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleDeleteClick}
              onKeyDown={handleDeleteKeyDown}
              title="Delete project"
              aria-label="Delete project"
              className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-danger! hover:bg-danger-light cursor-pointer transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
        </div>
        <Badge variant={variant} size="sm">{label}</Badge>
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
              backgroundColor: project.color || "#6366f1",
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
    </button>
  );
}
