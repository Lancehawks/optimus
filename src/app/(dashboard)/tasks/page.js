"use client";

import { useState, useCallback, useRef } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { Button, Tabs, SearchBox, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { taskService } from "@/services/api";
import TaskListView, { LaterTaskList } from "@/components/tasks/TaskListView";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import TaskModal from "@/components/tasks/TaskModal";
import TaskFilters from "@/components/tasks/TaskFilters";
import { Spinner } from "@/components/ui";

const viewTabs = [
  {
    key: "list",
    label: "List",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    key: "kanban",
    label: "Kanban",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
];

const sortOptions = [
  { value: "position", label: "Manual order" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created_at", label: "Date created" },
  { value: "title", label: "Title (A–Z)" },
];

export default function TasksPage() {
  const [activeView, setActiveView] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    project_id: "",
    search: "",
    sort: "position",
    order: "asc",
  });
  const [searchInput, setSearchInput] = useState("");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const searchDebounceRef = useRef(null);
  const quickAddRef = useRef(null);

  const { tasks, isLoading, refetch, setTasks } = useTasks(filters);
  const { projects } = useProjects();
  const { bulkAction } = useTaskMutations(refetch);
  const { addToast } = useToast();

  const activeFilterCount = ["status", "priority", "project_id"].filter((k) => filters[k]).length;
  const hasFilters = !!(filters.search || filters.status || filters.priority || filters.project_id);

  // Derived stats shown in the header
  const now = new Date();
  const activeTasks = tasks.filter((t) => t.status !== "done" && !t.deferred);
  const overdueCount = activeTasks.filter((t) => t.due_date && new Date(t.due_date) < now).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  // Opens modal immediately with partial list data, then loads full detail in background
  const handleTaskClick = useCallback(async (task) => {
    setEditingTask(task);
    setModalOpen(true);
    try {
      const data = await taskService.get(task.id);
      setEditingTask(data.task);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast]);

  const handleNewTask = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  // Optimistic quick-add
  const handleQuickAdd = async (title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const tempId = `temp-${Date.now()}`;
    const tempTask = { id: tempId, title: trimmed, status: "todo", priority: "medium", deferred: false };
    setTasks((prev) => [tempTask, ...prev]);
    setQuickAddTitle("");
    try {
      await taskService.create({ title: trimmed });
      refetch();
    } catch (error) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      addToast({ message: error.message, type: "error" });
    }
  };

  // Optimistic delete
  const handleDeleteTask = useCallback(async (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await taskService.delete(taskId);
    } catch (error) {
      refetch();
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast, refetch, setTasks]);

  // Optimistic defer toggle
  const handleDeferTask = useCallback(async (taskId, deferred) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, deferred } : t));
    try {
      await taskService.update(taskId, { deferred });
    } catch (error) {
      refetch();
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast, refetch, setTasks]);

  // Drag-and-drop: reorder active tasks, update all positions in one bulk call
  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const draggable = tasks.filter((t) => t.status !== "done" && !t.deferred);
    const oldIdx = draggable.findIndex((t) => t.id === active.id);
    const newIdx = draggable.findIndex((t) => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(draggable, oldIdx, newIdx);
    const rest = tasks.filter((t) => t.status === "done" || t.deferred);
    setTasks([...reordered, ...rest]);
    const positionUpdates = reordered.map((t, i) => ({ id: t.id, position: (i + 1) * 1000 }));
    try {
      await taskService.bulk({ action: "reorder", tasks: positionUpdates });
    } catch (error) {
      refetch();
      addToast({ message: "Failed to reorder tasks", type: "error" });
    }
  }, [tasks, setTasks, refetch, addToast]);

  // Debounce search so we don't fire an API call on every keystroke
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }));
    }, 300);
  };

  const handleBulkAction = async (action, taskIds) => {
    try {
      await bulkAction(action, taskIds);
      addToast({
        message: action === "delete" ? "Tasks deleted" : "Tasks marked as done",
        type: "success",
      });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskService.update(taskId, { status: newStatus });
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const clearAllFilters = () => {
    setFilters({ status: "", priority: "", project_id: "", search: "", sort: "position", order: "asc" });
    setSearchInput("");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-h1">Tasks</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-body-sm text-muted">
              {activeTasks.length} active
            </span>
            {overdueCount > 0 && (
              <>
                <span className="text-muted text-body-sm">·</span>
                <span className="text-body-sm text-danger font-medium">
                  {overdueCount} overdue
                </span>
              </>
            )}
            {doneCount > 0 && (
              <>
                <span className="text-muted text-body-sm">·</span>
                <span className="text-body-sm text-success">
                  {doneCount} done
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* Kanban tab hidden on mobile — list only on small screens */}
          <div className="hidden sm:block">
            <Tabs tabs={viewTabs} activeTab={activeView} onChange={setActiveView} />
          </div>
          <Button
            onClick={handleNewTask}
            className="hidden sm:flex"
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            New Task
          </Button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 mb-4">
        <SearchBox
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search tasks..."
          className="flex-1"
        />

        <div className="flex items-center gap-2 shrink-0">
          {/* Sort — hidden on mobile, shown on sm+ */}
          <div className="relative hidden sm:block">
            <select
              value={filters.sort}
              onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
              className="appearance-none bg-surface-raised border border-border hover:border-border-strong rounded-md pl-3 pr-7 py-1.5 text-xs text-heading cursor-pointer transition-colors focus:outline-none focus:border-brand-500"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted pointer-events-none"
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>

          {/* Filters */}
          <Button
            variant={showFilters || activeFilterCount > 0 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
            }
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-brand-500 text-white text-[0.625rem] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </Button>

        </div>
      </div>

      {/* ── Filters panel ── */}
      {showFilters && (
        <div className="card p-4 mb-4">
          {/* Sort — shown in filters panel on mobile only */}
          <div className="sm:hidden mb-3 pb-3 border-b border-border">
            <p className="text-caption text-muted mb-1.5 font-medium uppercase tracking-wide">Sort by</p>
            <select
              value={filters.sort}
              onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
              className="w-full appearance-none bg-surface-raised border border-border rounded-md px-3 py-2 text-sm text-heading cursor-pointer focus:outline-none focus:border-brand-500"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <TaskFilters filters={filters} onFilterChange={setFilters} projects={projects} />
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : activeView === "list" ? (
        <>
          {/* Quick-add — above the list, clearly its own input area */}
          <div
            className="flex items-center gap-3 bg-surface border border-border-light hover:border-border-strong rounded-lg px-4 py-3 mb-3 focus-within:border-brand-500 focus-within:shadow-input-focus transition-all cursor-text"
            onClick={() => quickAddRef.current?.focus()}
          >
            <svg
              className="h-4 w-4 text-brand-500 shrink-0"
              fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <input
              ref={quickAddRef}
              className="flex-1 bg-transparent text-body-sm text-heading outline-none focus-visible:shadow-none! placeholder:text-placeholder"
              placeholder="Add a task — press Enter to save, or use New Task for full details"
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd(quickAddTitle);
                if (e.key === "Escape") setQuickAddTitle("");
              }}
            />
            {quickAddTitle ? (
              <kbd className="text-caption text-muted bg-surface-raised border border-border px-1.5 py-0.5 rounded shrink-0 font-mono">
                ↵
              </kbd>
            ) : (
              <span className="text-caption text-muted shrink-0 hidden sm:block">
                or use New Task for details
              </span>
            )}
          </div>

          {/* Main list card */}
          <div className="card">
            {tasks.filter((t) => !t.deferred).length === 0 ? (
              <EmptyState
                icon={
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title={hasFilters ? "No matching tasks" : "All clear"}
                description={
                  hasFilters
                    ? "No tasks match your current filters. Try adjusting or clearing them."
                    : "You're all caught up. Add a task above to get started."
                }
                action={
                  hasFilters
                    ? { children: "Clear filters", variant: "secondary", onClick: clearAllFilters }
                    : undefined
                }
              />
            ) : (
              <TaskListView
                tasks={tasks.filter((t) => !t.deferred)}
                onTaskClick={handleTaskClick}
                onBulkAction={handleBulkAction}
                onDelete={handleDeleteTask}
                onDefer={handleDeferTask}
                onDragEnd={handleDragEnd}
              />
            )}
          </div>

          {/* Later card — deferred tasks */}
          {tasks.filter((t) => t.deferred && t.status !== "done").length > 0 && (
            <LaterTaskList
              tasks={tasks.filter((t) => t.deferred && t.status !== "done")}
              onTaskClick={handleTaskClick}
              onDefer={handleDeferTask}
              onDelete={handleDeleteTask}
            />
          )}
        </>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No tasks yet"
          description={
            hasFilters
              ? "No tasks match your filters. Try adjusting or clearing them."
              : "Create your first task to get started."
          }
          action={
            !hasFilters ? { children: "Create Task", onClick: handleNewTask } : undefined
          }
        />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        onSave={refetch}
      />
    </div>
  );
}
