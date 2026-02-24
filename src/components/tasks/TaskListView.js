"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge, Checkbox, Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const priorityConfig = {
  urgent: { variant: "danger", label: "Urgent" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "neutral", label: "Low" },
};

const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  on_hold: "On Hold",
  done: "Done",
};

export default function TaskListView({ tasks, onTaskClick, onBulkAction }) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const handleBulkAction = (action) => {
    onBulkAction?.(action, Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <div>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 rounded-[var(--radius-lg)] mb-4 animate-slide-down">
          <span className="text-body-sm text-brand-700 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="secondary" onClick={() => handleBulkAction("complete")}>
              Mark Done
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleBulkAction("delete")}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border text-overline">
        <Checkbox
          checked={tasks.length > 0 && selectedIds.size === tasks.length}
          indeterminate={selectedIds.size > 0 && selectedIds.size < tasks.length}
          onChange={toggleAll}
        />
        <span className="flex-1">Task</span>
        <span className="w-20 text-center hidden sm:block">Priority</span>
        <span className="w-24 text-center hidden md:block">Status</span>
        <span className="w-28 text-right hidden lg:block">Due Date</span>
      </div>

      {/* Task rows */}
      <div className="divide-y divide-border-light">
        {tasks.map((task) => {
          const priority = priorityConfig[task.priority] || priorityConfig.medium;
          const isSelected = selectedIds.has(task.id);
          const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-tertiary/50 cursor-pointer",
                isSelected && "bg-brand-50/50"
              )}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => toggleSelect(task.id)}
              />

              <div className="flex-1 min-w-0" onClick={() => onTaskClick?.(task)}>
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-body-sm text-heading! font-medium truncate",
                    task.status === "done" && "line-through text-muted!"
                  )}>
                    {task.title}
                  </p>
                  {task.subtask_count > 0 && (
                    <span className="text-caption shrink-0">
                      ({task.subtask_done_count}/{task.subtask_count})
                    </span>
                  )}
                </div>
                {task.tags && task.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {task.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: tag.color + "20", color: tag.color }}
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

              <div className="w-20 text-center hidden sm:block" onClick={() => onTaskClick?.(task)}>
                <Badge variant={priority.variant} size="sm">{priority.label}</Badge>
              </div>

              <div className="w-24 text-center hidden md:block" onClick={() => onTaskClick?.(task)}>
                <span className={cn(
                  "text-caption font-medium",
                  task.status === "done" && "text-success!"
                )}>
                  {statusLabels[task.status]}
                </span>
              </div>

              <div className="w-28 text-right hidden lg:block" onClick={() => onTaskClick?.(task)}>
                {task.due_date && (
                  <span className={cn("text-caption", isOverdue && "text-danger! font-medium")}>
                    {formatDate(task.due_date)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
