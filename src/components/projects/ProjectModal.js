"use client";

import { useState, useEffect, useRef } from "react";
import { Modal, Input, Textarea, Select, Button, DatePicker } from "@/components/ui";
import { useProjectMutations } from "@/hooks/useProjects";
import { useTaskMutations } from "@/hooks/useTasks";
import { useToast } from "@/components/ui";
import { cn, toLocalDateStr } from "@/lib/utils";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const typeOptions = [
  { value: "", label: "No type", icon: null },
  { value: "work", label: "Work", icon: "💼" },
  { value: "learning", label: "Learning", icon: "📚" },
  { value: "personal", label: "Personal", icon: "🏠" },
];

const PRESET_COLORS = [
  "#6366f1", // indigo (brand)
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

export default function ProjectModal({ isOpen, onClose, project, onSave, onDelete }) {
  const isEditing = !!project;
  const { addToast } = useToast();
  const { createProject, updateProject, deleteProject, isLoading } = useProjectMutations();
  const { createTask } = useTaskMutations();
  const taskInputRef = useRef(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Quick tasks (only for create mode)
  const [quickTasks, setQuickTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setColor(project.color || "#6366f1");
      setType(project.type || "");
      setStatus(project.status || "active");
      setStartDate(project.start_date ? project.start_date.split("T")[0] : "");
      setEndDate(project.end_date ? project.end_date.split("T")[0] : "");
      setQuickTasks([]);
      setCurrentTask("");
      setShowDeleteConfirm(false);
    } else {
      setName("");
      setDescription("");
      setColor("#6366f1");
      setType("");
      setStatus("active");
      setStartDate("");
      setEndDate("");
      setQuickTasks([]);
      setCurrentTask("");
      setShowDeleteConfirm(false);
    }
  }, [project, isOpen]);

  const handleAddQuickTask = () => {
    if (!currentTask.trim()) return;
    setQuickTasks((prev) => [...prev, currentTask.trim()]);
    setCurrentTask("");
    // Keep focus on input for rapid entry
    setTimeout(() => taskInputRef.current?.focus(), 0);
  };

  const handleRemoveQuickTask = (index) => {
    setQuickTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ message: "Name is required", type: "error" });
      return;
    }

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        type: type || null,
        status,
        isArchived: status === "archived",
        startDate: startDate || null,
        endDate: endDate || null,
      };

      if (isEditing) {
        await updateProject(project.id, data);
        addToast({ message: "Project updated", type: "success" });
      } else {
        const newProject = await createProject(data);

        // Include any unsaved text in the input field
        const allTasks = currentTask.trim()
          ? [...quickTasks, currentTask.trim()]
          : quickTasks;

        // Create quick tasks for the new project
        if (allTasks.length > 0) {
          for (const taskTitle of allTasks) {
            await createTask({
              title: taskTitle,
              projectId: newProject.id,
              status: "todo",
              priority: "medium",
            });
          }
        }

        addToast({
          message: allTasks.length > 0
            ? `Project created with ${allTasks.length} task${allTasks.length > 1 ? "s" : ""}`
            : "Project created",
          type: "success",
        });
      }
      onSave?.();
      onClose();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDelete = async (deleteTasks = false) => {
    try {
      await deleteProject(project.id, { deleteTasks });
      addToast({ message: "Project deleted", type: "success" });
      onClose();
      onDelete?.();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const footer = showDeleteConfirm ? (
    <>
      <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isLoading}>
        Cancel
      </Button>
      <Button variant="secondary" onClick={() => handleDelete(false)} isLoading={isLoading}>
        Keep tasks
      </Button>
      <Button variant="danger" onClick={() => handleDelete(true)} isLoading={isLoading}>
        Delete tasks
      </Button>
    </>
  ) : (
    <>
      {isEditing && (
        <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={isLoading} className="mr-auto">
          Delete
        </Button>
      )}
      <Button variant="secondary" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} isLoading={isLoading}>
        {isEditing ? "Save changes" : "Create project"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showDeleteConfirm ? "Delete Project" : isEditing ? "Edit Project" : "New Project"}
      size="lg"
      footer={footer}
    >
      {showDeleteConfirm ? (
        <div className="py-2">
          <p className="text-body text-heading">
            Are you sure you want to delete <span className="font-semibold">{project?.name}</span>?
          </p>
          <p className="text-body-sm text-muted mt-2">
            This project has tasks associated with it. Would you like to keep them or delete them along with the project?
          </p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Name"
          id="projectName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          required
        />

        <Textarea
          label="Description"
          id="projectDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this project about?"
          rows={3}
        />

        {/* Type selector */}
        <div>
          <label className="text-body-sm text-heading! font-medium block mb-2">Type</label>
          <div className="flex gap-2">
            {typeOptions.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-body-sm font-medium cursor-pointer transition-colors border",
                  type === t.value
                    ? "bg-brand-50 text-brand-700 border-brand-300"
                    : "bg-surface-secondary text-muted border-transparent hover:border-border hover:text-heading"
                )}
              >
                {t.icon && <span className="mr-1.5">{t.icon}</span>}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-body-sm text-heading! font-medium block mb-2">Color</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-lg cursor-pointer transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid currentColor" : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-body-sm text-heading! font-medium block mb-1.5">Status</label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={statusOptions}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">Start date</label>
            <DatePicker
              value={startDate}
              onChange={(date) => setStartDate(date ? toLocalDateStr(date) : "")}
              placeholder="Start date"
            />
          </div>
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-1.5">End date</label>
            <DatePicker
              value={endDate}
              onChange={(date) => setEndDate(date ? toLocalDateStr(date) : "")}
              placeholder="End date"
            />
          </div>
        </div>

        {/* Quick Tasks — only in create mode */}
        {!isEditing && (
          <div>
            <label className="text-body-sm text-heading! font-medium block mb-2">
              Quick Tasks
              <span className="text-muted! font-normal ml-1.5">Hit Enter to add multiple</span>
            </label>

            {quickTasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {quickTasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1.5 px-3 bg-surface-secondary rounded-lg group"
                  >
                    <span className="text-caption text-muted font-medium w-5">{i + 1}.</span>
                    <span className="text-body-sm text-heading! flex-1 truncate">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuickTask(i)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted hover:text-danger cursor-pointer transition-all"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={taskInputRef}
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddQuickTask();
                }
              }}
              placeholder={quickTasks.length > 0 ? "Add another task..." : "Type a task and hit Enter"}
              className="input-base w-full text-body-sm"
            />
          </div>
        )}
      </form>
      )}
    </Modal>
  );
}
