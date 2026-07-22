"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn, toLocalDateStr } from "@/lib/utils";
import { Badge, Button, DatePicker, ErrorState, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { useTaskMutations, useTags } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/context/AuthContext";
import { taskService } from "@/services/api";

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const recurrenceOptions = [
  { value: "", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function TaskModal({ isOpen, onClose, task, onSave, defaultProjectId }) {
  const isEditing = !!task;
  const { addToast } = useToast();
  const { user } = useAuth();
  const { createTask, updateTask, deleteTask, addSubtask, updateSubtask, deleteSubtask, isLoading } = useTaskMutations(onSave);
  const { tags: allTags, createTag, error: tagsError, refetch: refetchTags } = useTags();
  const { projects } = useProjects();
  const canEditTask = !isEditing || task?.user_id === user?.id || task?.is_project_owner;
  const canDeleteTask = isEditing && (
    task?.project_id ? Boolean(task?.is_project_owner) : task?.user_id === user?.id
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [dependencies, setDependencies] = useState([]);
  const [depSearch, setDepSearch] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedProjectMemberCount = selectedProject?.member_count || 1;
  const canEditSubtask = (subtask) => !isEditing || subtask.user_id === user?.id || task?.is_project_owner;
  const canDeleteSubtask = (subtask) => !isEditing || (
    task?.project_id ? Boolean(task?.is_project_owner) : subtask.user_id === user?.id
  );

  // Dependency search: debounced API search instead of loading all tasks
  const [depSearchResults, setDepSearchResults] = useState([]);
  const [depSearchLoading, setDepSearchLoading] = useState(false);
  const depSearchTimerRef = useRef(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "todo");
      setPriority(task.priority || "medium");
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
      setProjectId(task.project_id || "");
      setRecurrenceRule(task.recurrence_rule || "");
      setSelectedTags(task.tags?.map((t) => t.id) || []);
      setSubtasks(task.subtasks || []);
      setDependencies(task.dependencies || []);
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setProjectId(defaultProjectId || "");
      setRecurrenceRule("");
      setSelectedTags([]);
      setSubtasks([]);
      setDependencies([]);
    }
    setNewSubtask("");
    setNewTagName("");
    setDepSearch("");
    setDepSearchResults([]);
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  }, [task, isOpen, defaultProjectId]);

  // Load dependencies when editing
  useEffect(() => {
    if (isEditing && task?.id && isOpen) {
      taskService.getDependencies(task.id).then((data) => {
        setDependencies(data.dependencies || []);
      }).catch(() => {});
    }
  }, [task?.id, isOpen, isEditing]);

  // Debounced dependency search
  const handleDepSearchChange = useCallback((value) => {
    setDepSearch(value);
    clearTimeout(depSearchTimerRef.current);
    if (!value.trim()) {
      setDepSearchResults([]);
      return;
    }
    depSearchTimerRef.current = setTimeout(async () => {
      setDepSearchLoading(true);
      try {
        const data = await taskService.list({ search: value });
        setDepSearchResults(
          data.tasks
            .filter((t) => t.id !== task?.id)
            .filter((t) => !dependencies.find((d) => d.id === t.id))
            .slice(0, 5)
        );
      } catch {
        // ignore
      } finally {
        setDepSearchLoading(false);
      }
    }, 300);
  }, [task?.id, dependencies]);

  useEffect(() => {
    return () => clearTimeout(depSearchTimerRef.current);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEditTask) return;
    if (!title.trim()) {
      addToast({ message: "Title is required", type: "error" });
      return;
    }
    if (isSubmitting) return;

    if (isEditing && task.project_id && !projectId) {
      const confirmed = window.confirm("Moving this task to personal will hide it from collaborators. Continue?");
      if (!confirmed) return;
    }

    if (isEditing && !task.project_id && projectId) {
      const confirmed = window.confirm(`This task is shared with ${selectedProjectMemberCount} project member${selectedProjectMemberCount === 1 ? "" : "s"}. Continue?`);
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate || null,
        projectId: projectId || null,
        recurrenceRule: recurrenceRule || null,
        tags: selectedTags,
        dependencies: dependencies.map((d) => d.id),
      };

      if (isEditing) {
        await updateTask(task.id, data);
        addToast({ message: "Task updated", type: "success" });
      } else {
        const newTask = await createTask(data);
        // Create subtasks — non-blocking so a subtask failure doesn't keep the modal open
        if (subtasks.length > 0 && newTask?.id) {
          for (const st of subtasks) {
            await addSubtask(newTask.id, st.title).catch(() => {});
          }
        }
        addToast({ message: "Task created", type: "success" });
      }
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteTask) return;
    try {
      await deleteTask(task.id);
      addToast({ message: "Task deleted", type: "success" });
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    if (isEditing) {
      try {
        const subtask = await addSubtask(task.id, newSubtask.trim());
        setSubtasks((prev) => [...prev, subtask]);
        setNewSubtask("");
      } catch (error) {
        addToast({ message: error.message, type: "error" });
      }
    } else {
      setSubtasks((prev) => [...prev, { id: Date.now(), title: newSubtask.trim(), status: "todo" }]);
      setNewSubtask("");
    }
  };

  const handleToggleSubtask = async (subtask) => {
    if (!canEditSubtask(subtask)) return;
    const newStatus = subtask.status === "done" ? "todo" : "done";
    if (isEditing) {
      try {
        await updateSubtask(task.id, subtask.id, { status: newStatus });
        setSubtasks((prev) =>
          prev.map((s) => (s.id === subtask.id ? { ...s, status: newStatus } : s))
        );
      } catch (error) {
        addToast({ message: error.message, type: "error" });
      }
    } else {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, status: newStatus } : s))
      );
    }
  };

  const handleDeleteSubtask = async (subtask) => {
    if (!canDeleteSubtask(subtask)) return;
    if (isEditing) {
      try {
        await deleteSubtask(task.id, subtask.id);
        setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
      } catch (error) {
        addToast({ message: error.message, type: "error" });
      }
    } else {
      setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
    }
  };

  const handleStartEditSubtask = (subtask) => {
    if (!canEditSubtask(subtask)) return;
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const handleSaveEditSubtask = async (subtask) => {
    const trimmed = editingSubtaskTitle.trim();
    if (!trimmed) {
      setEditingSubtaskId(null);
      return;
    }
    if (trimmed === subtask.title) {
      setEditingSubtaskId(null);
      return;
    }
    if (isEditing) {
      try {
        await updateSubtask(task.id, subtask.id, { title: trimmed });
        setSubtasks((prev) =>
          prev.map((s) => (s.id === subtask.id ? { ...s, title: trimmed } : s))
        );
      } catch (error) {
        addToast({ message: error.message, type: "error" });
      }
    } else {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, title: trimmed } : s))
      );
    }
    setEditingSubtaskId(null);
  };

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await createTag(newTagName.trim());
      setSelectedTags((prev) => [...prev, tag.id]);
      setNewTagName("");
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  // Dependency helpers
  const addDependency = (depTask) => {
    if (!dependencies.find((d) => d.id === depTask.id)) {
      setDependencies((prev) => [...prev, { id: depTask.id, title: depTask.title, status: depTask.status }]);
    }
    setDepSearch("");
    setDepSearchResults([]);
  };

  const removeDependency = (depId) => {
    setDependencies((prev) => prev.filter((d) => d.id !== depId));
  };

  const footer = (
    <>
      {canDeleteTask && (
        <Button variant="danger" onClick={handleDelete} disabled={isLoading} className="mr-auto">
          Delete
        </Button>
      )}
      <Button variant="secondary" onClick={onClose} disabled={isLoading}>
        {canEditTask ? "Cancel" : "Close"}
      </Button>
      {canEditTask && (
        <Button onClick={handleSubmit} isLoading={isLoading || isSubmitting}>
          {isEditing ? "Save changes" : "Create task"}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? (canEditTask ? "Edit Task" : "View Task") : "New Task"}
      size="lg"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset disabled={!canEditTask} className="m-0 min-w-0 space-y-5 border-0 p-0 disabled:opacity-80">
        <Input
          label="Title"
          id="taskTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
        />

        <Textarea
          label="Description"
          id="taskDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add more details..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Status</label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={statusOptions}
            />
          </div>
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Priority</label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={priorityOptions}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Due date</label>
            <DatePicker
              value={dueDate}
              onChange={(date) => setDueDate(date ? toLocalDateStr(date) : "")}
            />
          </div>
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Repeat</label>
            <Select
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value)}
              options={recurrenceOptions}
            />
            {recurrenceRule && (
              <p className="text-caption mt-1">
                When completed, a new task will be created automatically.
              </p>
            )}
          </div>
        </div>

        {/* Project */}
        {projects.length > 0 && (
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Project</label>
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={[
                { value: "", label: "Personal" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <div className="mt-2 rounded-lg border border-border bg-surface-secondary px-3 py-2">
              {projectId ? (
                <p className="text-caption text-muted!">
                  This task is shared with {selectedProjectMemberCount} project member{selectedProjectMemberCount === 1 ? "" : "s"} in{" "}
                  <span className="text-heading!">{selectedProject?.name || "this project"}</span>.
                </p>
              ) : (
                <p className="text-caption text-muted!">
                  Personal task. Only you can see it.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Dependencies — Blocked by */}
        <div>
          <label className="text-body-sm text-heading! font-medium block mb-2">Blocked by</label>
          {dependencies.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {dependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-2 py-1.5 px-2 bg-surface-tertiary rounded-lg"
                >
                  <span className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    dep.status === "done" ? "bg-green-500" : "bg-neutral-500"
                  )} />
                  <span className={cn(
                    "text-body-sm flex-1 truncate",
                    dep.status === "done" ? "text-muted! line-through" : "text-heading!"
                  )}>
                    {dep.title}
                  </span>
                  {dep.status === "done" && (
                    <span className="text-caption text-success!">Done</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDependency(dep.id)}
                    className="p-0.5 rounded text-muted hover:text-danger cursor-pointer transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <Input
              value={depSearch}
              onChange={(e) => handleDepSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              placeholder="Search tasks to add as dependency..."
              size="sm"
            />
            {depSearchLoading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-muted animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            {depSearchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-surface-raised border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {depSearchResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addDependency(t)}
                    className="w-full text-left px-3 py-2 text-body-sm hover:bg-surface-tertiary cursor-pointer transition-colors flex items-center gap-2"
                  >
                    <span className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      t.status === "done" ? "bg-green-500" : "bg-neutral-500"
                    )} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-body-sm text-heading! font-medium block mb-2">Tags</label>
          {tagsError && (
            <ErrorState
              compact
              className="mx-0 mb-3 py-4"
              title="Tags unavailable"
              description="Retry before changing task tags."
              onRetry={refetchTags}
            />
          )}
          <div className="flex flex-wrap gap-2 mb-2">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`badge cursor-pointer transition-colors ${
                  selectedTags.includes(tag.id)
                    ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                    : "bg-surface-tertiary text-muted border border-transparent hover:border-border"
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name"
              size="sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateTag();
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleCreateTag}>
              Add
            </Button>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-body-sm text-heading! font-medium block mb-2">
            Subtasks
            {subtasks.length > 0 && (
              <span className="text-caption text-muted ml-2 font-normal">
                {subtasks.filter((s) => s.status === "done").length}/{subtasks.length} done
              </span>
            )}
          </label>
          {subtasks.length > 0 && (
            <div className="space-y-1 mb-3">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="group flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-surface-tertiary/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(subtask)}
                    disabled={!canEditSubtask(subtask)}
                    className={`shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-colors ${
                      canEditSubtask(subtask) ? "cursor-pointer" : "cursor-default opacity-60"
                    } ${
                      subtask.status === "done"
                        ? "bg-brand-500 border-brand-500"
                        : "border-border-strong hover:border-brand-400"
                    }`}
                  >
                    {subtask.status === "done" && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>

                  {editingSubtaskId === subtask.id ? (
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-body-sm text-heading outline-none border-b border-brand-500 py-0.5"
                      value={editingSubtaskTitle}
                      onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                      onBlur={() => handleSaveEditSubtask(subtask)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleSaveEditSubtask(subtask); }
                        if (e.key === "Escape") setEditingSubtaskId(null);
                      }}
                    />
                  ) : (
                    <span
                      className={`flex-1 text-body-sm ${canEditSubtask(subtask) ? "cursor-pointer" : "cursor-default"} ${subtask.status === "done" ? "text-muted! line-through" : "text-heading!"}`}
                      onDoubleClick={() => handleStartEditSubtask(subtask)}
                    >
                      {subtask.title}
                    </span>
                  )}

                  {/* Edit & Delete buttons */}
                  {editingSubtaskId !== subtask.id && (canEditSubtask(subtask) || canDeleteSubtask(subtask)) && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEditSubtask(subtask) && (
                        <button
                          type="button"
                          onClick={() => handleStartEditSubtask(subtask)}
                          className="p-1 rounded text-muted hover:text-heading cursor-pointer transition-colors"
                          title="Edit subtask"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      )}
                      {canDeleteSubtask(subtask) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(subtask)}
                          className="p-1 rounded text-muted hover:text-danger cursor-pointer transition-colors"
                          title="Delete subtask"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add a subtask"
              size="sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddSubtask}>
              Add
            </Button>
          </div>
        </div>
        </fieldset>
      </form>
    </Modal>
  );
}
