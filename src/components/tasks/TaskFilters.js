"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { PriorityIcon, StatusIcon } from "./TaskGlyphs";

const statusOptions = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
        active
          ? "border-heading bg-heading text-surface"
          : "border-border bg-surface text-body hover:border-border-strong hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-16 shrink-0 text-xs text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function TaskFilters({ filters, onFilterChange, projects = [], sortOptions = [] }) {
  const activeCount = [filters.status, filters.priority, filters.project_id].filter(Boolean).length;

  const setFilter = (key, value) => {
    onFilterChange({ ...filters, [key]: filters[key] === value ? "" : value });
  };

  const clearFilters = () => {
    onFilterChange({ ...filters, status: "", priority: "", project_id: "" });
  };

  return (
    <div className="animate-slide-down space-y-3">
      <FilterGroup label="Status">
        {statusOptions.map((opt) => (
          <FilterChip key={opt.value} active={filters.status === opt.value} onClick={() => setFilter("status", opt.value)}>
            <StatusIcon status={opt.value} className={filters.status === opt.value ? "[&_*]:stroke-current" : ""} />
            {opt.label}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Priority">
        {priorityOptions.map((opt) => (
          <FilterChip key={opt.value} active={filters.priority === opt.value} onClick={() => setFilter("priority", opt.value)}>
            <PriorityIcon priority={opt.value} className={filters.priority === opt.value && opt.value !== "urgent" ? "text-surface" : ""} />
            {opt.label}
          </FilterChip>
        ))}
      </FilterGroup>

      {projects.length > 0 && (
        <FilterGroup label="Project">
          {projects.map((proj) => (
            <FilterChip key={proj.id} active={filters.project_id === proj.id} onClick={() => setFilter("project_id", proj.id)}>
              <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: proj.color }} />
              {proj.name}
              {proj.task_count > 0 && <span className="font-mono opacity-60">{proj.task_count}</span>}
            </FilterChip>
          ))}
        </FilterGroup>
      )}

      {sortOptions.length > 0 && (
        <FilterGroup label="Sort">
          {sortOptions.map((opt) => (
            <FilterChip key={opt.value} active={filters.sort === opt.value} onClick={() => onFilterChange({ ...filters, sort: opt.value })}>
              {opt.label}
            </FilterChip>
          ))}
        </FilterGroup>
      )}

      {activeCount > 0 && (
        <div className="sm:pl-20">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  );
}
