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
