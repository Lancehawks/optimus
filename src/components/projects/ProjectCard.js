"use client";

import { Trash2, Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import ProjectMark from "./ProjectMark";

export const projectStatusMeta = {
  active: { label: "Active", dot: "bg-success" },
  paused: { label: "Paused", dot: "bg-warning" },
  completed: { label: "Completed", dot: "bg-brand-500" },
  archived: { label: "Archived", dot: "bg-muted" },
};

const typeLabels = { work: "Work", learning: "Learning", personal: "Personal" };

function getDueDateWarning(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Past end date", className: "text-danger" };
  if (diffDays <= 7) return { text: `${diffDays}d left`, className: "text-warning" };
  return null;
}

export default function ProjectCard({ project, onClick, onDelete }) {
  const status = projectStatusMeta[project.status] || projectStatusMeta.active;
  const taskCount = project.task_count || 0;
  const taskDone = project.task_done_count || 0;
  const progress = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
  const dueDateWarning = project.status !== "completed" && project.status !== "archived" ? getDueDateWarning(project.end_date) : null;
  const color = project.color || "var(--neutral-400)";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(project)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(project);
        }
      }}
      className="card card-hover group flex min-h-48 w-full cursor-pointer flex-col p-5 text-left"
    >
      <div className="flex items-center gap-3">
        <ProjectMark project={project} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[1rem] font-semibold text-heading">{project.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
            {project.type && <span className="text-placeholder">· {typeLabels[project.type] || project.type}</span>}
          </p>
        </div>
        {project.is_owner && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(project);
            }}
            title="Delete project"
            aria-label={`Delete ${project.name}`}
            className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 self-start cursor-pointer items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-danger-light hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {project.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted">{project.description}</p>
      ) : (
        <div className="mt-3" />
      )}

      <div className="mt-auto pt-6">
        <div className="mb-2 flex items-baseline justify-between font-mono text-2xs tabular-nums text-muted">
          <span>
            {taskDone}/{taskCount} tasks
            {project.milestone_count > 0 && <> · {project.milestone_done_count}/{project.milestone_count} milestones</>}
          </span>
          <span className="text-heading">{progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-tertiary">
          <div className="animate-grow-x h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
        {(project.start_date || project.end_date || project.member_count > 1) && (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="font-mono text-2xs">
              {project.start_date && formatDate(project.start_date)}
              {project.start_date && project.end_date && " → "}
              {project.end_date && formatDate(project.end_date)}
              {dueDateWarning && <span className={cn("ml-2", dueDateWarning.className)}>{dueDateWarning.text}</span>}
            </span>
            {project.member_count > 1 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {project.member_count}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
