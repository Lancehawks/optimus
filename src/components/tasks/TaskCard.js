"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const priorityConfig = {
  urgent: { color: "bg-red-500", label: "Urgent" },
  high: { color: "bg-amber-500", label: "High" },
  medium: { color: "bg-blue-500", label: "Medium" },
  low: { color: "bg-neutral-400", label: "Low" },
};

export default function TaskCard({ task, onClick, isDragging }) {
  const priority = priorityConfig[task.priority] || priorityConfig.medium;

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        "card p-3.5 cursor-pointer card-hover",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", priority.color)} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-body-sm text-heading! font-medium",
            task.status === "done" && "line-through text-muted!"
          )}>
            {task.title}
          </p>

          {/* Project name */}
          {task.project_name && (
            <p className="text-caption mt-1 bg-surface-tertiary inline-block px-1.5 py-0.5 rounded">
              {task.project_name}
            </p>
          )}

          {/* Recurrence & blocked indicators */}
          {(task.recurrence_rule || task.blocking_count > 0) && (
            <div className="flex items-center gap-2 mt-1.5">
              {task.recurrence_rule && (
                <span className="text-caption text-brand-500 flex items-center gap-1" title={`Repeats ${task.recurrence_rule}`}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M4.031 9.865H2.985" />
                  </svg>
                  {task.recurrence_rule}
                </span>
              )}
              {task.blocking_count > 0 && (
                <span className="text-caption text-amber-500 flex items-center gap-1" title={`Blocked by ${task.blocking_count} task(s)`}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  blocked
                </span>
              )}
            </div>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.due_date && (
              <span className={cn(
                "text-caption",
                new Date(task.due_date) < new Date() && task.status !== "done" ? "text-danger!" : ""
              )}>
                {formatDate(task.due_date)}
              </span>
            )}

            {task.subtask_count > 0 && (
              <span className="text-caption">
                {task.subtask_done_count}/{task.subtask_count}
              </span>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
