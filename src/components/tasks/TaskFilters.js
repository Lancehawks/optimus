"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const sortOptions = [
  { value: "position", label: "Manual" },
  { value: "due_date", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "created_at", label: "Created" },
  { value: "title", label: "Title" },
];

export default function TaskFilters({ filters, onFilterChange, projects = [] }) {
  const activeCount = [filters.status, filters.priority, filters.project_id].filter(Boolean).length;

  const setFilter = (key, value) => {
    onFilterChange({ ...filters, [key]: filters[key] === value ? "" : value });
  };

  const clearFilters = () => {
    onFilterChange({ status: "", priority: "", project_id: "", sort: "position", order: "asc" });
  };

  return (
    <div className="space-y-3 animate-slide-down">
      {/* Status */}
      <div>
        <label className="text-overline mb-1.5 block">Status</label>
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter("status", opt.value)}
              className={cn(
                "badge cursor-pointer transition-colors",
                filters.status === opt.value
                  ? "bg-brand-500/15 text-brand-400"
                  : "bg-surface-tertiary text-muted hover:text-heading"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="text-overline mb-1.5 block">Priority</label>
        <div className="flex flex-wrap gap-1.5">
          {priorityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter("priority", opt.value)}
              className={cn(
                "badge cursor-pointer transition-colors",
                filters.priority === opt.value
                  ? "bg-brand-500/15 text-brand-400"
                  : "bg-surface-tertiary text-muted hover:text-heading"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project */}
      {projects.length > 0 && (
        <div>
          <label className="text-overline mb-1.5 block">Project</label>
          <div className="flex flex-wrap gap-1.5">
            {projects.map((proj) => (
              <button
                key={proj.id}
                onClick={() => setFilter("project_id", proj.id)}
                className={cn(
                  "badge cursor-pointer transition-colors",
                  filters.project_id === proj.id
                    ? "bg-brand-500/15 text-brand-400"
                    : "bg-surface-tertiary text-muted hover:text-heading"
                )}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: proj.color }}
                />
                {proj.name}
                {proj.task_count > 0 && (
                  <span className="ml-1 text-[0.625rem] opacity-70">({proj.task_count})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort */}
      <div>
        <label className="text-overline mb-1.5 block">Sort by</label>
        <div className="flex flex-wrap gap-1.5">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange({ ...filters, sort: opt.value })}
              className={cn(
                "badge cursor-pointer transition-colors",
                filters.sort === opt.value
                  ? "bg-brand-500/15 text-brand-400"
                  : "bg-surface-tertiary text-muted hover:text-heading"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters ({activeCount})
        </Button>
      )}
    </div>
  );
}
