"use client";

import { useState, useEffect } from "react";
import { Modal, Input, Textarea, Select, Button, DatePicker, Badge } from "@/components/ui";
import { useTaskMutations, useTags } from "@/hooks/useTasks";
import { useToast } from "@/components/ui";

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

export default function TaskModal({ isOpen, onClose, task, onSave }) {
  const isEditing = !!task;
  const { addToast } = useToast();
  const { createTask, updateTask, deleteTask, addSubtask, updateSubtask, isLoading } = useTaskMutations(onSave);
  const { tags: allTags, createTag } = useTags();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "todo");
      setPriority(task.priority || "medium");
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
      setSelectedTags(task.tags?.map((t) => t.id) || []);
      setSubtasks(task.subtasks || []);
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setSelectedTags([]);
      setSubtasks([]);
    }
    setNewSubtask("");
    setNewTagName("");
  }, [task, isOpen]);

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
        tags: selectedTags,
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
      // For new tasks, just add to local state
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

        <div>
          <label className="text-body-sm text-heading! font-medium block mb-1.5">Due date</label>
          <DatePicker
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
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
                    ? "bg-brand-100 text-brand-700 border border-brand-300"
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
                    className={`shrink-0 w-5 h-5 rounded-[var(--radius-sm)] border-2 flex items-center justify-center cursor-pointer transition-colors ${
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
