"use client";

import { CalendarDays, ListTree, Lock, Repeat2 } from "lucide-react";
import { cn, toLocalDateStr } from "@/lib/utils";
import { PriorityIcon, ProjectChip, TagChip } from "./TaskGlyphs";

function formatCardDate(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${toLocalDateStr(date)}T00:00:00`));
}

export default function TaskCard({ task, onClick, isDragging }) {
  const isDone = task.status === "done";
  const isOverdue = task.due_date && toLocalDateStr(task.due_date) < toLocalDateStr() && !isDone;
  const hasSubtasks = Number(task.subtask_count || 0) > 0;
  const hasBlockers = Number(task.blocking_count || 0) > 0;

  return (
    <article
      onClick={() => onClick?.(task)}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-surface p-3 shadow-xs transition-colors hover:border-border-strong",
        isDragging && "shadow-md",
        isDone && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2">
        <h4 className={cn("min-w-0 flex-1 text-sm leading-5 text-heading", isDone && "text-muted line-through")}>
          {task.title}
        </h4>
        <PriorityIcon priority={task.priority} className="mt-0.5" />
      </div>

      {task.project_name && <ProjectChip name={task.project_name} color={task.project_color} logoFileId={task.project_logo_file_id} className="mt-2" />}

      {task.tags?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => <TagChip key={tag.id} tag={tag} />)}
          {task.tags.length > 3 && <span className="text-2xs text-muted">+{task.tags.length - 3}</span>}
        </div>
      )}

      {(task.due_date || hasSubtasks || task.recurrence_rule || hasBlockers) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs tabular-nums text-muted">
          {task.due_date && (
            <span className={cn("inline-flex items-center gap-1", isOverdue && "text-danger")}>
              <CalendarDays className="h-3 w-3" />
              {formatCardDate(task.due_date)}
            </span>
          )}
          {hasSubtasks && (
            <span className="inline-flex items-center gap-1">
              <ListTree className="h-3 w-3" />
              {task.subtask_done_count || 0}/{task.subtask_count}
            </span>
          )}
          {task.recurrence_rule && (
            <span className="inline-flex items-center gap-1" title={`Repeats ${task.recurrence_rule}`}>
              <Repeat2 className="h-3 w-3" />
              {task.recurrence_rule}
            </span>
          )}
          {hasBlockers && (
            <span className="inline-flex items-center gap-1 text-warning" title={`Blocked by ${task.blocking_count} task(s)`}>
              <Lock className="h-3 w-3" />
              Blocked
            </span>
          )}
        </div>
      )}
    </article>
  );
}
