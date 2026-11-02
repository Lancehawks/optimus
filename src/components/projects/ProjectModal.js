"use client";

import { useState, useEffect, useRef } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button, DatePicker, Input, Modal, Select, Tabs, Textarea, useToast } from "@/components/ui";
import ProjectMark, { projectLogoUrl } from "@/components/projects/ProjectMark";
import { useAuth } from "@/context/AuthContext";
import { useProjectMutations } from "@/hooks/useProjects";
import { useTaskMutations } from "@/hooks/useTasks";
import { prepareProjectLogo, uploadWorkspaceFile } from "@/lib/uploadClient";
import { UPLOAD_RULES } from "@/lib/uploadRules";
import { cn, toLocalDateStr } from "@/lib/utils";
import { fileService, projectService } from "@/services/api";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const typeOptions = [
  { key: "", label: "None" },
  { key: "work", label: "Work" },
  { key: "learning", label: "Learning" },
  { key: "personal", label: "Personal" },
];

const PRESET_COLORS = [
  "#0d6b88", // ocean
  "#3868c6", // cobalt
  "#dfb63b", // amber
  "#cf5c63", // coral
  "#745388", // violet
  "#27836c", // jade
];

export default function ProjectModal({ isOpen, onClose, project, onSave, onDelete, startInDeleteConfirm = false }) {
  const isEditing = !!project;
  const { user } = useAuth();
  const isCreator = isEditing && (project?.user_id === user?.id || project?.is_owner);
  const { addToast } = useToast();
  const { createProject, updateProject, deleteProject, isLoading } = useProjectMutations();
  const { createTask } = useTaskMutations();
  const taskInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#0d6b88");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [collaboratorEmails, setCollaboratorEmails] = useState("");

  // A new logo is held locally and uploaded on save, so cancelling the
  // dialog leaves nothing behind in storage.
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Quick tasks (only for create mode)
  const [quickTasks, setQuickTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState("");

  // Covers the full submit flow (create + invites + quick tasks), not just the
  // initial project creation call, so the button stays in a loading state until
  // everything is actually done.
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setColor(project.color || "#0d6b88");
      setType(project.type || "");
      setStatus(project.status || "active");
      setStartDate(project.start_date ? project.start_date.split("T")[0] : "");
      setEndDate(project.end_date ? project.end_date.split("T")[0] : "");
      setCollaboratorEmails("");
      setLogoFile(null);
      setLogoPreview(null);
      setLogoRemoved(false);
      setQuickTasks([]);
      setCurrentTask("");
      setShowDeleteConfirm(Boolean(startInDeleteConfirm) && isCreator);
    } else {
      setName("");
      setDescription("");
      setColor("#0d6b88");
      setType("");
      setStatus("active");
      setStartDate("");
      setEndDate("");
      setCollaboratorEmails("");
      setLogoFile(null);
      setLogoPreview(null);
      setLogoRemoved(false);
      setQuickTasks([]);
      setCurrentTask("");
      setShowDeleteConfirm(false);
    }
  }, [project, isOpen, startInDeleteConfirm, isCreator]);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const logoUrl = logoPreview || (isEditing && !logoRemoved ? projectLogoUrl(project) : null);

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareProjectLogo(file);
      setLogoFile(prepared);
      setLogoPreview(URL.createObjectURL(prepared));
      setLogoRemoved(false);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
  };

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
    if (isSubmitting) return;

    setIsSubmitting(true);
    let uploadedLogo = null;
    let logoSaved = false;
    try {
      if (logoFile) {
        uploadedLogo = await uploadWorkspaceFile(logoFile, { userId: user.id, purpose: "project_logo" });
      }
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
      if (uploadedLogo) data.logoFileId = uploadedLogo.id;
      else if (logoRemoved) data.logoFileId = null;

      if (isEditing) {
        await updateProject(project.id, data);
        logoSaved = true;
        addToast({ message: "Project updated", type: "success" });
      } else {
        const newProject = await createProject(data);
        logoSaved = true;
        const emails = collaboratorEmails
          .split(/[,\s]+/)
          .map((email) => email.trim())
          .filter(Boolean);
        let collaboratorFailures = 0;

        for (const email of [...new Set(emails)]) {
          try {
            await projectService.addMember(newProject.id, email);
          } catch {
            collaboratorFailures++;
          }
        }

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

        if (collaboratorFailures > 0) {
          addToast({ message: "Project created. Some invitations could not be sent.", type: "warning" });
        } else {
          addToast({
            message: allTasks.length > 0
              ? `Project created with ${allTasks.length} task${allTasks.length > 1 ? "s" : ""}`
              : emails.length > 0
                ? "Project created and invitations sent"
                : "Project created",
            type: "success",
          });
        }
      }
      onSave?.();
      onClose();
    } catch (error) {
      if (uploadedLogo && !logoSaved) fileService.delete(uploadedLogo.id).catch(() => {});
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsSubmitting(false);
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
      <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isLoading} className="mr-auto">
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
      {isCreator && (
        <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} disabled={isLoading} className="mr-auto text-danger! hover:bg-danger-light!" leftIcon={<Trash2 />}>
          Delete
        </Button>
      )}
      <Button variant="ghost" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} isLoading={isLoading || isSubmitting}>
        {isEditing ? "Save changes" : "Create project"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showDeleteConfirm ? "Delete project" : isEditing ? "Edit project" : "New project"}
      size="lg"
      footer={footer}
    >
      {showDeleteConfirm ? (
        <div className="py-1">
          <p className="text-sm text-heading">
            Delete <span className="font-semibold">{project?.name}</span>?
          </p>
          <p className="mt-2 text-sm text-muted">
            Its tasks can stay in your list as personal tasks, or be deleted with the project.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start gap-4">
            {/* A mouse shortcut; the "Add a logo" link below is the accessible control. */}
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              tabIndex={-1}
              aria-hidden="true"
              title={logoUrl ? "Change logo" : "Add a logo"}
              className="group relative shrink-0 cursor-pointer rounded-xl"
            >
              <ProjectMark project={{ name, color }} logoUrl={logoUrl} size="lg" />
              <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ImagePlus className="h-5 w-5" />
              </span>
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept={UPLOAD_RULES.project_logo.contentTypes.join(",")}
              onChange={handleLogoChange}
              className="hidden"
              tabIndex={-1}
            />
            <div className="min-w-0 flex-1">
              <textarea
                id="projectName"
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Project name"
                rows={1}
                required
                className="block w-full resize-none border-0 bg-transparent p-0 font-serif text-[1.75rem] leading-9 text-heading outline-none [field-sizing:content] placeholder:text-placeholder"
              />
              <p className="mt-0.5 flex items-center gap-3 text-xs">
                <button type="button" onClick={() => logoInputRef.current?.click()} className="cursor-pointer text-muted transition-colors hover:text-heading">
                  {logoUrl ? "Change logo" : "Add a logo"}
                </button>
                {logoUrl && (
                  <button type="button" onClick={handleRemoveLogo} className="cursor-pointer text-muted transition-colors hover:text-danger">
                    Remove
                  </button>
                )}
              </p>
            </div>
          </div>

          <Textarea
            label="Description"
            id="projectDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What outcome does this project deliver?"
            rows={2}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-heading">Type</p>
              <Tabs tabs={typeOptions} activeTab={type} onChange={setType} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-heading">Colour</p>
              <div className="flex h-8 items-center gap-2" role="radiogroup" aria-label="Project colour">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Colour ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110",
                      color === c && "ring-2 ring-heading ring-offset-2 ring-offset-surface"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />
            <DatePicker label="Starts" value={startDate} onChange={(date) => setStartDate(date ? toLocalDateStr(date) : "")} placeholder="No date" />
            <DatePicker label="Ends" value={endDate} onChange={(date) => setEndDate(date ? toLocalDateStr(date) : "")} placeholder="No date" />
          </div>

          {!isEditing && (
            <Input
              label="Collaborators"
              value={collaboratorEmails}
              onChange={(e) => setCollaboratorEmails(e.target.value)}
              placeholder="name@lancehawks.com, teammate@lancehawks.com"
              hint="Separate emails with commas. Each person needs an Optimus account."
            />
          )}

          {!isEditing && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-heading">First tasks</p>
              <div className="rounded-lg border border-border">
                {quickTasks.map((task, i) => (
                  <div key={i} className="group flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-border-strong" />
                    <span className="flex-1 truncate text-sm text-heading">{task}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuickTask(i)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      aria-label={`Remove ${task}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2.5 px-3 py-1.5">
                  <Plus className="h-3.5 w-3.5 text-muted" />
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
                    aria-label="Add a first task"
                    placeholder={quickTasks.length > 0 ? "Add another" : "Type a task, press Enter"}
                    className="flex-1 bg-transparent py-1 text-sm text-heading outline-none placeholder:text-placeholder"
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
