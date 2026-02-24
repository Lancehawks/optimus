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

export default function TaskFilters({ filters, onFilterChange }) {
  const activeCount = [filters.status, filters.priority].filter(Boolean).length;

  const setFilter = (key, value) => {
    onFilterChange({ ...filters, [key]: filters[key] === value ? "" : value });
  };

  const clearFilters = () => {
    onFilterChange({ status: "", priority: "", sort: "position", order: "asc" });
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
                  ? "bg-brand-100 text-brand-700"
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
                  ? "bg-brand-100 text-brand-700"
                  : "bg-surface-tertiary text-muted hover:text-heading"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
                  ? "bg-brand-100 text-brand-700"
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
