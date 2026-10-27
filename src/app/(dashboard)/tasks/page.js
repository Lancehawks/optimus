"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { arrayMove } from "@dnd-kit/sortable";
import { ChevronDown, CircleCheck, Columns3, CornerDownLeft, List, Plus, SlidersHorizontal } from "lucide-react";
import { Button, EmptyState, ErrorState, SearchBox, Tabs, useToast } from "@/components/ui";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/context/AuthContext";
import { taskService } from "@/services/api";
import PageHeader, { PageHeaderStat } from "@/components/layout/PageHeader";
import TaskListView, { LaterTaskList, ArchivedTaskList } from "@/components/tasks/TaskListView";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import TaskModal from "@/components/tasks/TaskModal";
import TaskFilters from "@/components/tasks/TaskFilters";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

const viewTabs = [
  { key: "list", label: "List", icon: <List /> },
  { key: "kanban", label: "Board", icon: <Columns3 /> },
];

const sortOptions = [
  { value: "position", label: "Manual order" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created_at", label: "Date created" },
  { value: "title", label: "Title (A–Z)" },
];

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("project_id") || "";
  const queryView = searchParams.get("view");
  const querySearch = searchParams.get("search") || "";
  const queryTaskId = searchParams.get("task_id") || "";
  const initialView = queryView === "kanban" || queryView === "list" ? queryView : "list";

  const [activeView, setActiveView] = useState(initialView);
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    project_id: queryProjectId,
    search: querySearch,
    sort: "position",
    order: "asc",
  });
  const [searchInput, setSearchInput] = useState(querySearch);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const searchDebounceRef = useRef(null);
  const quickAddRef = useRef(null);

  const { tasks, pagination, isLoading, error, refetch, setTasks, hasMore, loadMore, isLoadingMore } = useTasks({ ...filters, include_archived: showArchived ? "true" : "" });
  const { projects } = useProjects();
  const { user } = useAuth();
  const { bulkAction } = useTaskMutations(refetch);
  const { addToast } = useToast();

  useEffect(() => {
    const nextView = queryView === "kanban" || queryView === "list" ? queryView : "list";

    setActiveView((prev) => (prev === nextView ? prev : nextView));

    setFilters((prev) => (
      prev.project_id === queryProjectId && prev.search === querySearch
        ? prev
        : { ...prev, project_id: queryProjectId, search: querySearch }
    ));
    setSearchInput((prev) => (prev === querySearch ? prev : querySearch));
  }, [queryProjectId, querySearch, queryView]);

  useEffect(() => {
    if (!queryTaskId) return;
    if (modalOpen && editingTask?.id === queryTaskId) return;

    let isActive = true;
    taskService.get(queryTaskId)
      .then((data) => {
        if (!isActive) return;
        setEditingTask(data.task);
        setModalOpen(true);
      })
      .catch((error) => {
        if (isActive) addToast({ message: error.message, type: "error" });
      });

    return () => {
      isActive = false;
    };
  }, [addToast, editingTask?.id, modalOpen, queryTaskId]);

  const activeFilterCount = ["status", "priority", "project_id"].filter((k) => filters[k]).length;
  const hasFilters = !!(filters.search || filters.status || filters.priority || filters.project_id);

  // Derived stats shown in the header

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

  // Optimistic quick-add — inherits active project filter
  const handleQuickAdd = async (title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const tempId = `temp-${Date.now()}`;
    const projectId = filters.project_id || null;
    const project = projectId ? projects.find((p) => p.id === projectId) : null;
    const tempTask = {
      id: tempId,
      title: trimmed,
      status: "todo",
      priority: "medium",
      deferred: false,
      project_id: projectId,
      project_name: project?.name || null,
    };
    setTasks((prev) => [tempTask, ...prev]);
    setQuickAddTitle("");
    try {
      await taskService.create({ title: trimmed, projectId });
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

  // Optimistic archive toggle
  const handleArchiveTask = useCallback(async (taskId, isArchived) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, is_archived: isArchived } : t));
    try {
      await taskService.update(taskId, { isArchived });
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

  // Optimistic inline status toggle (done ↔ todo)
  const handleToggleComplete = useCallback(async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await taskService.update(taskId, { status: newStatus });
    } catch (error) {
      refetch();
      addToast({ message: error.message, type: "error" });
    }
  }, [tasks, setTasks, refetch, addToast]);

  // Update subtask done count from inline subtask toggling
  const handleSubtaskCountChange = useCallback((taskId, newDoneCount) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtask_done_count: newDoneCount } : t));
  }, [setTasks]);

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
      const messages = { delete: "Tasks deleted", archive: "Tasks archived", complete: "Tasks marked as done" };
      addToast({ message: messages[action] || "Tasks updated", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await taskService.update(taskId, { status: newStatus });
    } catch (error) {
      refetch();
      addToast({ message: error.message, type: "error" });
    }
  };

  const clearAllFilters = () => {
    setFilters({ status: "", priority: "", project_id: "", search: "", sort: "position", order: "asc" });
    setSearchInput("");
  };

  // Find active project name for quick-add hint
  const activeProject = filters.project_id ? projects.find((p) => p.id === filters.project_id) : null;

  const visibleTasks = tasks.filter((t) => !t.deferred && !t.is_archived);
  const laterTasks = tasks.filter((t) => t.deferred && t.status !== "done" && !t.is_archived);
  const archivedTasks = tasks.filter((t) => t.is_archived);

  return (
    <div className="page">
      <PageHeader
        title="Tasks"
        description={activeProject ? `Focused on ${activeProject.name}.` : undefined}
        meta={<PageHeaderStat label={pagination.filteredCount === 1 ? "task" : "tasks"} value={pagination.filteredCount || 0} />}
        actions={
          <>
            <Tabs tabs={viewTabs} activeTab={activeView} onChange={setActiveView} />
            <Button onClick={handleNewTask} leftIcon={<Plus />}>
              New task
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <SearchBox value={searchInput} onChange={handleSearchChange} placeholder="Search tasks" />
        </div>

        {projects.length > 0 && (
          <div className="relative hidden sm:block">
            <select
              value={filters.project_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, project_id: e.target.value }))}
              className="input-base focus:input-focus h-[2.125rem] w-auto cursor-pointer appearance-none pr-8!"
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          </div>
        )}

        <Button
          variant={showFilters || activeFilterCount > 0 ? "secondary" : "ghost"}
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<SlidersHorizontal />}
          aria-expanded={showFilters}
        >
          Filter
          {activeFilterCount > 0 && (
            <span className="font-mono text-2xs tabular-nums text-muted">{activeFilterCount}</span>
          )}
        </Button>

        <label className="ml-auto flex cursor-pointer select-none items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--brand-500)]"
          />
          Show archived
        </label>
      </div>

      {showFilters && (
        <div className="mb-4 rounded-xl border border-border bg-surface-secondary p-4">
          <TaskFilters filters={filters} onFilterChange={setFilters} projects={projects} sortOptions={sortOptions} />
        </div>
      )}

      {isLoading ? (
        <div className="card divide-y divide-border">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-3 px-4 py-3.5">
              <div className="skeleton h-4 w-4 rounded-full" />
              <div className="skeleton h-3.5" style={{ width: `${55 - row * 6}%` }} />
            </div>
          ))}
        </div>
      ) : error && tasks.length === 0 ? (
        <ErrorState
          title="Tasks couldn't be loaded"
          description={error.message || "Check your connection and try again."}
          onRetry={refetch}
        />
      ) : activeView === "list" ? (
        <>
          {error && (
            <ErrorState
              compact
              className="mb-4"
              title="Some tasks may be missing"
              description={error.message || "The latest tasks couldn't be loaded."}
              onRetry={refetch}
            />
          )}

          <div className="card overflow-hidden">
            <div
              className="flex cursor-text items-center gap-3 border-b border-border py-2.5 pl-2 pr-4 transition-colors focus-within:bg-surface-secondary sm:pl-[3.75rem]"
              onClick={() => quickAddRef.current?.focus()}
            >
              <Plus className="h-4 w-4 shrink-0 text-muted" />
              <input
                ref={quickAddRef}
                className="min-w-0 flex-1 bg-transparent text-sm text-heading outline-none placeholder:text-placeholder"
                placeholder={activeProject ? `Add a task to ${activeProject.name}` : "Add a task"}
                aria-label="Add a task"
                value={quickAddTitle}
                onChange={(e) => setQuickAddTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickAdd(quickAddTitle);
                  if (e.key === "Escape") setQuickAddTitle("");
                }}
              />
              {quickAddTitle && (
                <kbd className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-3xs text-muted">
                  <CornerDownLeft className="h-3 w-3" /> to add
                </kbd>
              )}
            </div>

            {visibleTasks.length === 0 ? (
              <EmptyState
                icon={<CircleCheck />}
                title={hasFilters ? "No matching tasks" : "All clear"}
                description={
                  hasFilters
                    ? "Nothing matches these filters. Loosen them to see more."
                    : "Nothing on your list. Add a task above when something comes up."
                }
                action={hasFilters ? { children: "Clear filters", variant: "secondary", onClick: clearAllFilters } : undefined}
              />
            ) : (
              <TaskListView
                tasks={visibleTasks}
                onTaskClick={handleTaskClick}
                onBulkAction={handleBulkAction}
                onDelete={handleDeleteTask}
                onDefer={handleDeferTask}
                onArchive={handleArchiveTask}
                onDragEnd={handleDragEnd}
                onToggleComplete={handleToggleComplete}
                onSubtaskCountChange={handleSubtaskCountChange}
                currentUserId={user?.id}
              />
            )}
          </div>

          {laterTasks.length > 0 && (
            <LaterTaskList
              tasks={laterTasks}
              onTaskClick={handleTaskClick}
              onDefer={handleDeferTask}
              onDelete={handleDeleteTask}
              onArchive={handleArchiveTask}
              onToggleComplete={handleToggleComplete}
              onSubtaskCountChange={handleSubtaskCountChange}
              currentUserId={user?.id}
            />
          )}

          {showArchived && archivedTasks.length > 0 && (
            <ArchivedTaskList
              tasks={archivedTasks}
              onTaskClick={handleTaskClick}
              onArchive={handleArchiveTask}
              onDelete={handleDeleteTask}
              onToggleComplete={handleToggleComplete}
              onSubtaskCountChange={handleSubtaskCountChange}
              currentUserId={user?.id}
            />
          )}
        </>
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CircleCheck />}
            title="No tasks yet"
            description={hasFilters ? "Nothing matches these filters." : "Create your first task to start the board."}
            action={!hasFilters ? { children: "New task", onClick: handleNewTask } : undefined}
          />
        </div>
      ) : (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          currentUserId={user?.id}
        />
      )}

      {!isLoading && !error && tasks.length > 0 && (
        <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
      )}

      <TaskModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
          if (queryTaskId) router.replace("/tasks");
        }}
        task={editingTask}
        onSave={refetch}
        defaultProjectId={filters.project_id || undefined}
      />
    </div>
  );
}
