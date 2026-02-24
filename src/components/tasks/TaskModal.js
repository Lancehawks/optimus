"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Modal, Input, Textarea, Select, Button, DatePicker, Badge } from "@/components/ui";
import { useTaskMutations, useTags, useTasks } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useToast } from "@/components/ui";
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
  const { createTask, updateTask, deleteTask, addSubtask, updateSubtask, isLoading } = useTaskMutations(onSave);
  const { tags: allTags, createTag } = useTags();
  const { projects } = useProjects();
  const { tasks: allTasks } = useTasks();

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
  }, [task, isOpen]);

  // Load dependencies when editing
  useEffect(() => {
    if (isEditing && task?.id && isOpen) {
      taskService.getDependencies(task.id).then((data) => {
        setDependencies(data.dependencies || []);
      }).catch(() => {});
    }
  }, [task?.id, isOpen, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast({ message: "Title is required", type: "error" });
      return;
    }

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
        await createTask(data);
        addToast({ message: "Task created", type: "success" });
      }
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDelete = async () => {
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
  };

  const removeDependency = (depId) => {
    setDependencies((prev) => prev.filter((d) => d.id !== depId));
  };

  // Filter tasks for dependency search (exclude self and already-selected)
  const depSearchResults = depSearch.trim().length > 0
    ? allTasks
        .filter((t) => t.id !== task?.id)
        .filter((t) => !dependencies.find((d) => d.id === t.id))
        .filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase()))
        .slice(0, 5)
    : [];

  const footer = (
    <>
      {isEditing && (
        <Button variant="danger" onClick={handleDelete} disabled={isLoading} className="mr-auto">
          Delete
        </Button>
      )}
      <Button variant="secondary" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} isLoading={isLoading}>
        {isEditing ? "Save changes" : "Create task"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Task" : "New Task"}
      size="lg"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
              onChange={(date) => setDueDate(date ? date.toISOString().split("T")[0] : "")}
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
                { value: "", label: "No project" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
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
              onChange={(e) => setDepSearch(e.target.value)}
              placeholder="Search tasks to add as dependency..."
              size="sm"
            />
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
          <label className="text-body-sm text-heading! font-medium block mb-2">Subtasks</label>
          {subtasks.length > 0 && (
            <div className="space-y-2 mb-3">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-3 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(subtask)}
                    className={`shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center cursor-pointer transition-colors ${
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
                  <span className={`text-body-sm ${subtask.status === "done" ? "text-muted! line-through" : "text-heading!"}`}>
                    {subtask.title}
                  </span>
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
      </form>
    </Modal>
  );
}
