"use client";

import { useState, useCallback } from "react";
import { Button, Tabs, SearchBox, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui";
import { useTasks, useTaskMutations } from "@/hooks/useTasks";
import { taskService } from "@/services/api";
import TaskListView from "@/components/tasks/TaskListView";
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

export default function TasksPage() {
  const [activeView, setActiveView] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    search: "",
    sort: "position",
    order: "asc",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const { tasks, isLoading, refetch } = useTasks(filters);
  const { bulkAction } = useTaskMutations(refetch);
  const { addToast } = useToast();

  const handleTaskClick = useCallback(async (task) => {
    try {
      const data = await taskService.get(task.id);
      setEditingTask(data.task);
      setModalOpen(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast]);

  const handleNewTask = () => {
    setEditingTask(null);
    setModalOpen(true);
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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h1">Tasks</h1>
          <p className="text-body-sm text-muted! mt-1">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={handleNewTask} leftIcon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        }>
          New Task
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <SearchBox
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Search tasks..."
          className="sm:max-w-xs"
        />

        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            variant={showFilters ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
            }
          >
            Filters
          </Button>

          <Tabs tabs={viewTabs} activeTab={activeView} onChange={setActiveView} />
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card p-4 mb-4">
          <TaskFilters filters={filters} onFilterChange={setFilters} />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="No tasks yet"
          description={filters.search || filters.status || filters.priority
            ? "No tasks match your filters. Try adjusting or clearing them."
            : "Create your first task to get started."}
          action={!filters.search && !filters.status && !filters.priority ? { children: "Create Task", onClick: handleNewTask } : undefined}
        />
      ) : activeView === "list" ? (
        <div className="card">
          <TaskListView
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onBulkAction={handleBulkAction}
          />
        </div>
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
