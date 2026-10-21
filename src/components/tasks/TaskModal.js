"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn, toLocalDateStr } from "@/lib/utils";
import { CalendarDays, Check, FolderKanban, Pencil, Plus, Repeat2, Search, Trash2, X } from "lucide-react";
import { Button, DatePicker, ErrorState, Input, Modal, Select, Spinner, useToast } from "@/components/ui";
import { PriorityIcon, StatusIcon } from "./TaskGlyphs";
import { useTaskMutations, useTags } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/context/AuthContext";
import { taskService } from "@/services/api";

const statusOptions = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
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
        <Button variant="ghost" onClick={handleDelete} disabled={isLoading} className="mr-auto text-danger! hover:bg-danger-light!" leftIcon={<Trash2 />}>
          Delete
        </Button>
      )}
      <Button variant="ghost" onClick={onClose} disabled={isLoading}>
        {canEditTask ? "Cancel" : "Close"}
      </Button>
      {canEditTask && (
        <Button onClick={handleSubmit} isLoading={isLoading || isSubmitting}>
          {isEditing ? "Save changes" : "Create task"}
        </Button>
      )}
    </>
  );

  const subtleSelect = "border-transparent! bg-transparent! shadow-none! hover:border-border! focus:border-brand-500!";
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? (canEditTask ? "Task" : "Task · view only") : "New task"}
      size="lg"
      placement="right"
      footer={footer}
    >
      <form onSubmit={handleSubmit}>
        <fieldset disabled={!canEditTask} className="m-0 min-w-0 border-0 p-0 disabled:opacity-80">
          <textarea
            id="taskTitle"
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Task title"
            rows={1}
            required
            className="block w-full resize-none border-0 bg-transparent p-0 font-serif text-[1.75rem] leading-9 text-heading outline-none [field-sizing:content] placeholder:text-placeholder"
          />
          <textarea
            id="taskDescription"
            aria-label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description…"
            rows={2}
            className="mt-2 block min-h-12 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-body outline-none [field-sizing:content] placeholder:text-placeholder"
          />

          <dl className="mt-6 grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1 border-y border-border py-3">
            <dt className="flex items-center gap-2 text-xs text-muted"><StatusIcon status={status} />Status</dt>
            <dd><Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} className={subtleSelect} aria-label="Status" /></dd>

            <dt className="flex items-center gap-2 text-xs text-muted"><PriorityIcon priority={priority} />Priority</dt>
            <dd><Select value={priority} onChange={(e) => setPriority(e.target.value)} options={priorityOptions} className={subtleSelect} aria-label="Priority" /></dd>

            <dt className="flex items-center gap-2 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" />Due</dt>
            <dd>
              <DatePicker
                value={dueDate}
                onChange={(date) => setDueDate(date ? toLocalDateStr(date) : "")}
                placeholder="No due date"
                className="[&>button]:border-transparent [&>button]:bg-transparent [&>button]:shadow-none [&>button:hover]:border-border"
              />
            </dd>

            <dt className="flex items-center gap-2 text-xs text-muted"><Repeat2 className="h-3.5 w-3.5" />Repeat</dt>
            <dd><Select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value)} options={recurrenceOptions} className={subtleSelect} aria-label="Repeat" /></dd>

            {projects.length > 0 && (
              <>
                <dt className="flex items-center gap-2 text-xs text-muted"><FolderKanban className="h-3.5 w-3.5" />Project</dt>
                <dd>
                  <Select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className={subtleSelect}
                    aria-label="Project"
                    options={[{ value: "", label: "Personal" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
                  />
                </dd>
              </>
            )}
          </dl>
          <p className="mt-2 text-xs text-muted">
            {recurrenceRule ? "A new copy is created when this is completed. " : ""}
            {projectId
              ? `Visible to ${selectedProjectMemberCount} member${selectedProjectMemberCount === 1 ? "" : "s"} of ${selectedProject?.name || "this project"}.`
              : "Personal — only you can see it."}
          </p>

          {/* Subtasks */}
          <section className="mt-8">
            <h3 className="mb-2 flex items-baseline gap-2 text-overline">
              Subtasks
              {subtasks.length > 0 && <span className="normal-case tracking-normal">{doneSubtasks}/{subtasks.length}</span>}
            </h3>
            {subtasks.length > 0 && (
              <div className="mb-2">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="group -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-secondary">
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(subtask)}
                      disabled={!canEditSubtask(subtask)}
                      aria-label={subtask.status === "done" ? "Reopen subtask" : "Complete subtask"}
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] transition-colors",
                        canEditSubtask(subtask) ? "cursor-pointer" : "cursor-default opacity-50",
                        subtask.status === "done" ? "border-brand-500 bg-brand-500 text-white" : "border-border-strong hover:border-heading"
                      )}
                    >
                      {subtask.status === "done" && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                    </button>

                    {editingSubtaskId === subtask.id ? (
                      <input
                        autoFocus
                        className="flex-1 border-b border-brand-500 bg-transparent py-0.5 text-sm text-heading outline-none"
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
                        className={cn(
                          "flex-1 text-sm",
                          canEditSubtask(subtask) ? "cursor-text" : "cursor-default",
                          subtask.status === "done" ? "text-muted line-through" : "text-heading"
                        )}
                        onDoubleClick={() => handleStartEditSubtask(subtask)}
                      >
                        {subtask.title}
                      </span>
                    )}

                    {editingSubtaskId !== subtask.id && (canEditSubtask(subtask) || canDeleteSubtask(subtask)) && (
                      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                        {canEditSubtask(subtask) && (
                          <button type="button" onClick={() => handleStartEditSubtask(subtask)} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-heading" title="Rename subtask">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteSubtask(subtask) && (
                          <button type="button" onClick={() => handleDeleteSubtask(subtask)} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-danger" title="Delete subtask">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <Plus className="h-3.5 w-3.5 text-muted" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add a subtask"
                aria-label="Add a subtask"
                className="flex-1 bg-transparent py-1 text-sm text-heading outline-none placeholder:text-placeholder"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
              />
            </div>
          </section>

          {/* Dependencies */}
          <section className="mt-8">
            <h3 className="mb-2 text-overline">Blocked by</h3>
            {dependencies.length > 0 && (
              <div className="mb-2 divide-y divide-border rounded-lg border border-border">
                {dependencies.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2.5 px-3 py-2">
                    <StatusIcon status={dep.status === "done" ? "done" : "todo"} />
                    <span className={cn("flex-1 truncate text-sm", dep.status === "done" ? "text-muted line-through" : "text-heading")}>
                      {dep.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDependency(dep.id)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-danger"
                      aria-label={`Remove ${dep.title}`}
                    >
                      <X className="h-3.5 w-3.5" />
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
                placeholder="Search for a blocking task"
                size="sm"
                leftIcon={<Search />}
                rightIcon={depSearchLoading ? <Spinner size="sm" /> : null}
              />
              {depSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-md">
                  {depSearchResults.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addDependency(t)}
                      className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-body hover:bg-surface-tertiary hover:text-heading"
                    >
                      <StatusIcon status={t.status} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Tags */}
          <section className="mt-8">
            <h3 className="mb-2 text-overline">Tags</h3>
            {tagsError && (
              <ErrorState compact className="mb-3" title="Tags unavailable" description="Retry before changing task tags." onRetry={refetchTags} />
            )}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
                      active ? "border-heading bg-surface-tertiary text-heading" : "border-border text-muted hover:border-border-strong hover:text-heading"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag"
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
          </section>
        </fieldset>
      </form>
    </Modal>
  );
}
