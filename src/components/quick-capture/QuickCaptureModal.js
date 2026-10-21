"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Modal, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { useBookmarkMutations } from "@/hooks/useBookmarks";
import { useEventMutations } from "@/hooks/useCalendar";
import { useNoteMutations } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useTaskMutations } from "@/hooks/useTasks";
import { parseQuickCapture } from "@/lib/quickCaptureParser";
import { useAuth } from '@/context/AuthContext';
import { resolveTimeZone, zonedInputToDate, wallDate } from '@/lib/calendarTime';

const TYPES = [
  { id: "task", label: "Task" },
  { id: "event", label: "Event" },
  { id: "note", label: "Note" },
  { id: "bookmark", label: "Bookmark" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const durationOptions = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

function localDateTimeToISO(dateValue, timeValue, timeZone) {
  if (!dateValue || !timeValue) return null;
  return zonedInputToDate(`${dateValue}T${timeValue}`, timeZone).toISOString();
}

function addMinutesToISO(isoValue, minutes) {
  return new Date(new Date(isoValue).getTime() + minutes * 60 * 1000).toISOString();
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function getEntityLabel(type) {
  return TYPES.find((item) => item.id === type)?.label || "Item";
}

export default function QuickCaptureModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const timeZone = resolveTimeZone(user?.timezone);
  const inputRef = useRef(null);
  const { addToast } = useToast();
  const { projects } = useProjects({ include_archived: "false" });
  const { createTask } = useTaskMutations();
  const { createNote } = useNoteMutations();
  const { createEvent } = useEventMutations();
  const { createBookmark } = useBookmarkMutations();

  const [rawInput, setRawInput] = useState("");
  const [lockedType, setLockedType] = useState(null);
  const [draft, setDraft] = useState(() => parseQuickCapture(""));
  const [scope, setScope] = useState("personal");
  const [projectId, setProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProject = projects.find((project) => project.id === projectId);
  const canShare = draft.canShare;

  useEffect(() => {
    if (!isOpen) return;

    setRawInput("");
    setLockedType(null);
    setDraft(parseQuickCapture(""));
    setScope("personal");
    setProjectId("");
    setIsSubmitting(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    const nextDraft = parseQuickCapture(rawInput, {
      now: wallDate(new Date(), timeZone),
      forcedType: lockedType || undefined,
    });
    setDraft(nextDraft);
    if (!nextDraft.canShare) {
      setScope("personal");
      setProjectId("");
    }
  }, [rawInput, lockedType, timeZone]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.member_count > 1
          ? `${project.name} (${project.member_count} members)`
          : project.name,
      })),
    [projects]
  );

  const validation = useMemo(() => {
    if (!rawInput.trim()) return "Add something to capture";
    if (!draft.title.trim()) return "Title is required";
    if (scope === "shared" && canShare && !projectId) return "Choose a project";
    if (draft.type === "bookmark" && (!draft.url || !isValidUrl(draft.url))) return "Valid URL is required";
    if (draft.type === "event" && (!draft.eventDate || !draft.eventTime)) return "Event date and time are required";
    return "";
  }, [canShare, draft, projectId, rawInput, scope]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleTypeChange(type) {
    setLockedType(type);
    const nextDraft = parseQuickCapture(rawInput, { forcedType: type, now: wallDate(new Date(), timeZone) });
    setDraft(nextDraft);
    if (!nextDraft.canShare) {
      setScope("personal");
      setProjectId("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (validation || isSubmitting) {
      if (validation) addToast({ message: validation, type: "error" });
      return;
    }

    const targetProjectId = canShare && scope === "shared" ? projectId : null;
    setIsSubmitting(true);

    try {
      if (draft.type === "task") {
        await createTask({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          priority: draft.priority,
          dueDate: draft.dueDate || null,
          projectId: targetProjectId,
        });
      } else if (draft.type === "note") {
        await createNote({
          title: draft.title.trim(),
          content: draft.description.trim(),
          projectId: targetProjectId,
        });
      } else if (draft.type === "event") {
        const startTime = localDateTimeToISO(draft.eventDate, draft.eventTime, timeZone);
        await createEvent({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          start_time: startTime,
          end_time: addMinutesToISO(startTime, Number(draft.durationMinutes) || 60),
          projectId: targetProjectId,
        });
      } else if (draft.type === "bookmark") {
        await createBookmark({
          url: draft.url.trim(),
          title: draft.title.trim(),
          description: draft.description.trim() || null,
        });
      }

      addToast({
        message: `${getEntityLabel(draft.type)} created${targetProjectId && selectedProject ? ` in ${selectedProject.name}` : ""}`,
        type: "success",
      });
      onClose();
    } catch (error) {
      addToast({ message: error.message || "Capture failed", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <>
      <p className="mr-auto hidden text-xs text-muted sm:block">{validation || "Ready to save"}</p>
      <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" form="quickCaptureForm" isLoading={isSubmitting} disabled={!!validation}>
        Create {getEntityLabel(draft.type)}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick capture"
      description="Type naturally. Try “task send invoice friday high” or “event review at 3pm”."
      size="lg"
      footer={footer}
    >
      <form id="quickCaptureForm" onSubmit={handleSubmit} className="space-y-5">
        <textarea
          ref={inputRef}
          aria-label="Capture"
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          placeholder="What’s on your mind?"
          rows={2}
          className="block w-full resize-none border-0 bg-transparent p-0 font-serif text-[1.625rem] leading-8 text-heading outline-none placeholder:text-placeholder"
        />

        <Tabs
          tabs={TYPES.map((type) => ({ key: type.id, label: type.label }))}
          activeTab={draft.type}
          onChange={handleTypeChange}
        />

        <div className="space-y-4 border-t border-border pt-5">
          <Input label="Title" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />

          {draft.type === "task" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Priority"
                value={draft.priority}
                onChange={(event) => updateDraft("priority", event.target.value)}
                options={priorityOptions}
              />
              <Input
                label="Due date"
                type="date"
                value={draft.dueDate}
                onChange={(event) => updateDraft("dueDate", event.target.value)}
              />
            </div>
          )}

          {draft.type === "event" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Date" type="date" value={draft.eventDate} onChange={(event) => updateDraft("eventDate", event.target.value)} />
              <Input label="Time" type="time" value={draft.eventTime} onChange={(event) => updateDraft("eventTime", event.target.value)} />
              <Select
                label="Duration"
                value={String(draft.durationMinutes)}
                onChange={(event) => updateDraft("durationMinutes", Number(event.target.value))}
                options={durationOptions}
              />
            </div>
          )}

          {draft.type === "bookmark" && (
            <Input
              label="URL"
              value={draft.url}
              onChange={(event) => updateDraft("url", event.target.value)}
              placeholder="https://example.com"
            />
          )}

          <Textarea
            label={draft.type === "note" ? "Content" : "Description"}
            value={draft.description}
            onChange={(event) => updateDraft("description", event.target.value)}
            rows={draft.type === "note" ? 5 : 2}
            autoResize
          />

          {canShare && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-heading">Visibility</p>
                <Tabs
                  tabs={[{ key: "personal", label: "Personal" }, { key: "shared", label: "Shared project" }]}
                  activeTab={scope}
                  onChange={(next) => {
                    setScope(next);
                    if (next === "personal") setProjectId("");
                  }}
                />
              </div>
              {scope === "shared" && (
                <div className="min-w-48 flex-1">
                  <Select
                    label="Project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    placeholder="Choose project"
                    options={projectOptions}
                  />
                </div>
              )}
            </div>
          )}
          {canShare && scope === "shared" && selectedProject && (
            <p className="text-xs text-muted">
              Visible to {selectedProject.member_count || 1} project member{(selectedProject.member_count || 1) === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
