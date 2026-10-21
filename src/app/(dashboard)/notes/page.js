"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  LayoutTemplate,
  Lock,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button, EmptyState, ErrorState, Modal, SearchBox, Spinner, Tabs, useToast } from "@/components/ui";
import { useNotes, useNoteMutations, useNotebooks } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { noteService } from "@/services/api";
import { cn, formatDate } from "@/lib/utils";
import NotebookSidebar from "@/components/notes/NotebookSidebar";
import NoteList from "@/components/notes/NoteList";
import JournalView from "@/components/notes/JournalView";
import TemplateSelector, { templates } from "@/components/notes/TemplateSelector";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

const NoteEditor = dynamic(() => import("@/components/notes/NoteEditor"), {
  ssr: false,
  loading: () => <div className="flex min-h-64 items-center justify-center"><Spinner /></div>,
});

const viewTabs = [
  { key: "all", label: "All" },
  { key: "journals", label: "Journals" },
  { key: "pinned", label: "Pinned" },
];

export default function NotesPage() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("project_id") || "";
  const initialNoteId = searchParams.get("note_id") || "";
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedNotebookId, setSelectedNotebookId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedNote, setSelectedNote] = useState(null);
  const [panelsOpen, setPanelsOpen] = useState(true);
  const [mobilePane, setMobilePane] = useState("list"); // "list" | "editor" — mobile only
  const [isMobile, setIsMobile] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { addToast } = useToast();

  const searchDebounceRef = useRef(null);
  const saveStatusTimerRef = useRef(null);
  const deleteTimerRef = useRef(null);
  const titleSaveTimerRef = useRef(null);
  const pendingTitleSaveRef = useRef(null);
  const noteEditorRef = useRef(null);
  const updateNoteRef = useRef(null);
  const selectedNoteIdRef = useRef(null);
  const noteSaveQueuesRef = useRef(new Map());
  const activeSaveCountsRef = useRef(new Map());
  const failedNoteChangesRef = useRef(new Map());

  useEffect(() => {
    selectedNoteIdRef.current = selectedNote?.id || null;
  }, [selectedNote]);

  const resetNoteUiState = useCallback(() => {
    clearTimeout(deleteTimerRef.current);
    setConfirmingDelete(false);
    setSaveStatus("idle");
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    clearTimeout(searchDebounceRef.current);
    clearTimeout(saveStatusTimerRef.current);
    clearTimeout(deleteTimerRef.current);
    clearTimeout(titleSaveTimerRef.current);
  }, []);

  const filters = {
    ...(selectedNotebookId ? { notebook_id: selectedNotebookId } : {}),
    ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
    ...(activeTab === "journals" ? { is_journal: "true" } : {}),
    ...(activeTab === "pinned" ? { is_pinned: "true" } : {}),
    ...(search ? { search } : {}),
  };

  const { notes, pagination, isLoading, error, refetch, hasMore, loadMore, isLoadingMore } = useNotes(filters);
  const { createNote, updateNote, deleteNote, togglePin } = useNoteMutations(refetch);
  const {
    notebooks,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    error: notebooksError,
    refetch: refetchNotebooks,
  } = useNotebooks();
  const { projects } = useProjects();

  useEffect(() => {
    updateNoteRef.current = updateNote;
  }, [updateNote]);

  const queueNoteUpdate = useCallback((noteId, changes) => {
    const previous = noteSaveQueuesRef.current.get(noteId) || Promise.resolve();
    const request = previous
      .catch(() => undefined)
      .then(() => updateNoteRef.current(noteId, changes));

    noteSaveQueuesRef.current.set(noteId, request);
    const removeCompletedRequest = () => {
      if (noteSaveQueuesRef.current.get(noteId) === request) {
        noteSaveQueuesRef.current.delete(noteId);
      }
    };
    request.then(removeCompletedRequest, removeCompletedRequest);
    return request;
  }, []);

  const saveNoteChanges = useCallback(async (noteId, changes) => {
    try {
      const updated = await queueNoteUpdate(noteId, changes);
      const failedChanges = failedNoteChangesRef.current.get(noteId);
      if (failedChanges) {
        Object.keys(changes).forEach((key) => delete failedChanges[key]);
        if (Object.keys(failedChanges).length === 0) {
          failedNoteChangesRef.current.delete(noteId);
        } else {
          failedNoteChangesRef.current.set(noteId, failedChanges);
        }
      }
      return updated;
    } catch (error) {
      failedNoteChangesRef.current.set(noteId, {
        ...(failedNoteChangesRef.current.get(noteId) || {}),
        ...changes,
      });
      throw error;
    }
  }, [queueNoteUpdate]);

  const trackNoteSave = useCallback(async (noteId, changes) => {
    const nextCount = (activeSaveCountsRef.current.get(noteId) || 0) + 1;
    activeSaveCountsRef.current.set(noteId, nextCount);
    if (selectedNoteIdRef.current === noteId) setSaveStatus("saving");

    try {
      return await saveNoteChanges(noteId, changes);
    } finally {
      const remaining = Math.max(0, (activeSaveCountsRef.current.get(noteId) || 1) - 1);
      if (remaining > 0) {
        activeSaveCountsRef.current.set(noteId, remaining);
      } else {
        activeSaveCountsRef.current.delete(noteId);
        if (selectedNoteIdRef.current === noteId) {
          clearTimeout(saveStatusTimerRef.current);
          if (failedNoteChangesRef.current.has(noteId)) {
            setSaveStatus("error");
          } else {
            setSaveStatus("saved");
            saveStatusTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
          }
        }
      }
    }
  }, [saveNoteChanges]);

  const flushTitleSave = useCallback(async () => {
    clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = null;
    const pending = pendingTitleSaveRef.current;
    pendingTitleSaveRef.current = null;
    if (!pending) return null;

    try {
      return await trackNoteSave(pending.noteId, { title: pending.title });
    } catch (error) {
      console.error("Title save failed:", error);
      return null;
    }
  }, [trackNoteSave]);

  const discardPendingTitleSave = useCallback(() => {
    clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = null;
    pendingTitleSaveRef.current = null;
  }, []);

  const flushAllPendingSaves = useCallback(async () => {
    await Promise.all([
      flushTitleSave(),
      noteEditorRef.current?.flush?.() || Promise.resolve(),
    ]);
  }, [flushTitleSave]);

  const retryFailedSave = useCallback(async () => {
    const noteId = selectedNoteIdRef.current;
    const changes = noteId ? failedNoteChangesRef.current.get(noteId) : null;
    if (!noteId || !changes) return;
    try {
      await trackNoteSave(noteId, { ...changes });
    } catch (error) {
      console.error("Note save retry failed:", error);
    }
  }, [trackNoteSave]);

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      const noteId = selectedNoteIdRef.current;
      const hasUnsavedChanges = Boolean(
        pendingTitleSaveRef.current ||
        (noteId && activeSaveCountsRef.current.has(noteId)) ||
        (noteId && failedNoteChangesRef.current.has(noteId))
      );
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
      void flushTitleSave();
    };
    const flushOnPageHide = () => {
      void flushTitleSave();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("pagehide", flushOnPageHide);
      flushOnPageHide();
    };
  }, [flushTitleSave]);
  const canEditSelectedNote = Boolean(selectedNote) && (
    selectedNote.user_id === user?.id || selectedNote.is_project_owner
  );
  const canDeleteSelectedNote = Boolean(selectedNote) && (
    selectedNote.project_id ? Boolean(selectedNote.is_project_owner) : selectedNote.user_id === user?.id
  );
  const selectedNoteProject = selectedNote?.project_id
    ? projects.find((project) => project.id === selectedNote.project_id)
    : null;
  const selectedNoteProjectMemberCount = selectedNoteProject?.member_count || 1;

  // Stats for the list panel header
  const pinnedCount = notes.filter((n) => n.is_pinned).length;

  // Debounced search — prevents API call on every keystroke
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  const handleSelectNote = useCallback(async (note) => {
    try {
      await flushAllPendingSaves();
      const data = await noteService.get(note.id);
      const failedChanges = failedNoteChangesRef.current.get(note.id);
      setSelectedNote(failedChanges ? { ...data.note, ...failedChanges } : data.note);
      resetNoteUiState();
      if (failedChanges) setSaveStatus("error");
      setMobilePane("editor"); // navigate to editor on mobile
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [flushAllPendingSaves, resetNoteUiState, addToast]);

  useEffect(() => {
    if (!initialNoteId) return;

    let isActive = true;
    const openInitialNote = async () => {
      try {
        await flushAllPendingSaves();
        const data = await noteService.get(initialNoteId);
        if (!isActive) return;
        const failedChanges = failedNoteChangesRef.current.get(initialNoteId);
        setSelectedNote(failedChanges ? { ...data.note, ...failedChanges } : data.note);
        resetNoteUiState();
        if (failedChanges) setSaveStatus("error");
        setMobilePane("editor");
      } catch (error) {
        if (isActive) addToast({ message: error.message, type: "error" });
      }
    };
    void openInitialNote();

    return () => {
      isActive = false;
    };
  }, [initialNoteId, flushAllPendingSaves, resetNoteUiState, addToast]);

  // "New Note" button → instant blank note, no modal
  const handleNewBlankNote = async () => {
    const blank = templates.find((t) => t.name === "blank");
    await handleCreateWithTemplate(blank);
  };

  const handleCreateWithTemplate = async (template) => {
    try {
      await flushAllPendingSaves();
      const note = await createNote({
        title: template.name === "blank" ? "Untitled" : template.label,
        content: template.content,
        notebookId: selectedProjectId ? null : selectedNotebookId,
        projectId: selectedProjectId || null,
        templateName: template.name,
      });
      setSelectedNote(note);
      resetNoteUiState();
      setShowTemplates(false);
      setMobilePane("editor");
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleCreateJournalEntry = async (dateStr) => {
    const reflectionTemplate = templates.find((t) => t.name === "daily_reflection");
    try {
      await flushAllPendingSaves();
      const note = await createNote({
        title: `Journal — ${new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        })}`,
        content: reflectionTemplate?.content || "",
        isJournal: true,
        journalDate: dateStr,
        templateName: "daily_reflection",
      });
      setSelectedNote(note);
      resetNoteUiState();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  // Auto-save with status indicator
  const handleContentChange = useCallback(async (content) => {
    if (!selectedNote || !canEditSelectedNote) return;
    const noteId = selectedNote.id;
    try {
      await trackNoteSave(noteId, { content });
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, [selectedNote, canEditSelectedNote, trackNoteSave]);

  const handleTitleChange = useCallback((e) => {
    if (!selectedNote || !canEditSelectedNote) return;
    const noteId = selectedNote.id;
    const title = e.target.value;
    setSelectedNote((prev) => (prev?.id === noteId ? { ...prev, title } : prev));
    setSaveStatus("saving");
    pendingTitleSaveRef.current = { noteId, title };
    clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = setTimeout(() => {
      void flushTitleSave();
    }, 500);
  }, [selectedNote, canEditSelectedNote, flushTitleSave]);

  const handleProjectChange = useCallback(async (projectId) => {
    if (!selectedNote || !canEditSelectedNote) return;
    const newProjectId = projectId || null;
    const nextProject = projects.find((p) => p.id === newProjectId);

    if (selectedNote.project_id && !newProjectId) {
      const confirmed = window.confirm("Moving this note to personal will hide it from collaborators. Continue?");
      if (!confirmed) return;
    }

    if (!selectedNote.project_id && newProjectId) {
      const memberCount = nextProject?.member_count || 1;
      const confirmed = window.confirm(`This note is shared with ${memberCount} project member${memberCount === 1 ? "" : "s"}. Continue?`);
      if (!confirmed) return;
    }

    try {
      await flushAllPendingSaves();
      await updateNote(selectedNote.id, { projectId: newProjectId });
      setSelectedNote((prev) => ({
        ...prev,
        project_id: newProjectId,
        project_name: nextProject?.name || null,
        project_color: nextProject?.color || null,
        notebook_id: newProjectId ? null : prev?.notebook_id,
        notebook_name: newProjectId ? null : prev?.notebook_name,
      }));
      refetch();
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [selectedNote, canEditSelectedNote, flushAllPendingSaves, updateNote, projects, refetch, addToast]);

  const handleProjectFilterChange = async (projectId) => {
    await flushAllPendingSaves();
    setSelectedProjectId(projectId);
    setSelectedNotebookId(null);
    setSelectedNote(null);
    resetNoteUiState();
  };

  const handleTogglePin = async () => {
    if (!selectedNote || !canEditSelectedNote) return;
    try {
      await flushAllPendingSaves();
      const updated = await togglePin(selectedNote.id, selectedNote.is_pinned);
      setSelectedNote((prev) => (
        prev?.id === updated.id
          ? { ...prev, is_pinned: updated.is_pinned, updated_at: updated.updated_at }
          : prev
      ));
      addToast({ message: updated.is_pinned ? "Note pinned" : "Note unpinned", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  // Pin from the note list (without a selectedNote open)
  const handleTogglePinById = useCallback(async (noteId, currentPinned) => {
    try {
      if (selectedNote?.id === noteId) await flushAllPendingSaves();
      const updated = await togglePin(noteId, currentPinned);
      if (selectedNote?.id === noteId) {
        setSelectedNote((prev) => (
          prev?.id === updated.id
            ? { ...prev, is_pinned: updated.is_pinned, updated_at: updated.updated_at }
            : prev
        ));
      }
      addToast({ message: updated.is_pinned ? "Note pinned" : "Note unpinned", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [togglePin, selectedNote, flushAllPendingSaves, addToast]);

  // Delete from the editor header (two-click confirm handled via state)
  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    try {
      await deleteNote(selectedNote.id);
      discardPendingTitleSave();
      noteEditorRef.current?.discard?.();
      setSelectedNote(null);
      resetNoteUiState();
      addToast({ message: "Note deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      clearTimeout(deleteTimerRef.current);
      setConfirmingDelete(false);
      handleDeleteNote();
    } else {
      setConfirmingDelete(true);
      deleteTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  // Delete from the note list row
  const handleDeleteNoteById = useCallback(async (noteId) => {
    try {
      await deleteNote(noteId);
      if (selectedNote?.id === noteId) {
        discardPendingTitleSave();
        noteEditorRef.current?.discard?.();
        setSelectedNote(null);
        resetNoteUiState();
      }
      addToast({ message: "Note deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [deleteNote, selectedNote, discardPendingTitleSave, resetNoteUiState, addToast]);

  const visibilityLabel = selectedNote?.project_id
    ? `Shared with ${selectedNoteProjectMemberCount} member${selectedNoteProjectMemberCount === 1 ? "" : "s"}`
    : "Private";

  const panelToggle = (
    <button
      type="button"
      onClick={() => setPanelsOpen((p) => !p)}
      title={panelsOpen ? "Hide lists" : "Show lists"}
      aria-label={panelsOpen ? "Hide lists" : "Show lists"}
      className="hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading lg:flex"
    >
      {panelsOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="page-fill flex-row!">
      {/* Notebooks */}
      <div
        style={{ width: panelsOpen ? "13.5rem" : "0px" }}
        className="hidden shrink-0 overflow-hidden border-r border-border bg-surface-secondary/60 transition-[width] duration-200 ease-out lg:block"
      >
        {notebooksError ? (
          <ErrorState compact className="m-3" title="Notebooks unavailable" description="Retry to load your notebooks." onRetry={refetchNotebooks} />
        ) : (
          <NotebookSidebar
            notebooks={notebooks}
            selectedNotebookId={selectedNotebookId}
            onSelectNotebook={async (id) => {
              await flushAllPendingSaves();
              setSelectedNotebookId(id);
              setSelectedProjectId("");
              setSelectedNote(null);
              resetNoteUiState();
            }}
            onCreateNotebook={createNotebook}
            onRenameNotebook={updateNotebook}
            onDeleteNotebook={deleteNotebook}
          />
        )}
      </div>

      {/* Note list */}
      <div
        style={{ width: isMobile ? undefined : panelsOpen ? "20rem" : "0px" }}
        className={cn(
          "shrink-0 overflow-hidden border-r border-border lg:transition-[width] lg:duration-200 lg:ease-out",
          mobilePane === "list" ? "flex w-full flex-col lg:w-auto" : "hidden lg:block"
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-col lg:w-80">
          <div className="shrink-0 space-y-2.5 border-b border-border px-4 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <h1 className="flex items-baseline gap-2 font-serif text-[1.625rem] leading-8 text-heading">
                Notes
                <span className="font-sans font-mono text-xs text-muted">{pagination.filteredCount || 0}</span>
              </h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowTemplates(true)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
                  title="New from template"
                  aria-label="New from template"
                >
                  <LayoutTemplate className="h-4 w-4" />
                </button>
                <Button size="icon" onClick={handleNewBlankNote} title="New note" aria-label="New note" className="h-7! min-h-7! w-7!">
                  <Plus />
                </Button>
              </div>
            </div>

            <SearchBox value={searchInput} onChange={handleSearchChange} placeholder="Search notes" />

            <div className="flex items-center gap-2">
              <Tabs
                size="sm"
                tabs={viewTabs}
                activeTab={activeTab}
                onChange={setActiveTab}
                className="shrink-0"
              />
              {projects.length > 0 && (
                <div className="relative min-w-0 flex-1">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectFilterChange(e.target.value)}
                    aria-label="Filter by project"
                    className="h-7 w-full cursor-pointer appearance-none truncate rounded-md border border-border bg-surface pl-2 pr-6 text-xs text-body outline-none transition-colors hover:border-border-strong"
                  >
                    <option value="">All notes</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="space-y-4 p-4">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="space-y-2">
                    <div className="skeleton h-3.5 w-2/3" />
                    <div className="skeleton h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : error && notes.length === 0 ? (
              <ErrorState compact className="m-3" title="Notes couldn't be loaded" description={error.message || "Check your connection and try again."} onRetry={refetch} />
            ) : activeTab === "journals" ? (
              <>
                {error && <ErrorState compact className="m-3" title="Some notes may be missing" description={error.message || "The latest notes couldn't be loaded."} onRetry={refetch} />}
                <div className="p-3">
                  <JournalView notes={notes} onSelectNote={handleSelectNote} onCreateJournalEntry={handleCreateJournalEntry} />
                </div>
                <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
              </>
            ) : (
              <>
                {error && <ErrorState compact className="m-3" title="Some notes may be missing" description={error.message || "The latest notes couldn't be loaded."} onRetry={refetch} />}
                <NoteList
                  notes={notes}
                  selectedNoteId={selectedNote?.id}
                  onSelectNote={handleSelectNote}
                  onPin={handleTogglePinById}
                  onDelete={handleDeleteNoteById}
                  currentUserId={user?.id}
                />
                <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className={cn("min-h-0 min-w-0 flex-1 flex-col", mobilePane === "editor" ? "flex" : "hidden lg:flex")}>
        {selectedNote ? (
          <div key={selectedNote.id} className="flex h-full animate-fade-in flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobilePane("list")}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary lg:hidden"
                  aria-label="Back to notes"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {panelToggle}
                <span className="flex h-5 items-center pl-1 text-xs" aria-live="polite">
                  {saveStatus === "saving" && <span className="flex animate-fade-in items-center gap-1.5 text-muted"><Spinner size="sm" />Saving</span>}
                  {saveStatus === "saved" && <span className="flex animate-fade-in items-center gap-1 text-muted"><Check className="h-3.5 w-3.5" />Saved</span>}
                  {saveStatus === "error" && (
                    <button
                      type="button"
                      onClick={retryFailedSave}
                      className="flex animate-fade-in cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-danger hover:bg-danger-light"
                      title="Retry saving your latest changes"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Not saved · Retry
                    </button>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <div className="relative">
                  <select
                    value={selectedNote.project_id || ""}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    disabled={!canEditSelectedNote}
                    aria-label="Note visibility"
                    className={cn(
                      "h-7 appearance-none rounded-md border border-transparent bg-transparent pl-7 pr-6 text-xs text-body outline-none transition-colors",
                      canEditSelectedNote ? "cursor-pointer hover:border-border hover:text-heading" : "cursor-default opacity-70"
                    )}
                  >
                    <option value="">Private</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {selectedNote.project_id
                    ? <Users className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    : <Lock className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />}
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
                </div>
                {canEditSelectedNote && (
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    title={selectedNote.is_pinned ? "Unpin note" : "Pin note"}
                    aria-label={selectedNote.is_pinned ? "Unpin note" : "Pin note"}
                    aria-pressed={selectedNote.is_pinned}
                    className={cn(
                      "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-tertiary",
                      selectedNote.is_pinned ? "text-heading" : "text-muted hover:text-heading"
                    )}
                  >
                    <Pin className={cn("h-4 w-4", selectedNote.is_pinned && "fill-current")} />
                  </button>
                )}
                {canDeleteSelectedNote && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    title={confirmingDelete ? "Click again to delete" : "Delete note"}
                    aria-label={confirmingDelete ? "Confirm delete" : "Delete note"}
                    className={cn(
                      "flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 text-xs transition-colors",
                      confirmingDelete ? "bg-danger-light text-danger" : "w-7 text-muted hover:bg-surface-tertiary hover:text-danger"
                    )}
                  >
                    {confirmingDelete ? <><TriangleAlert className="h-3.5 w-3.5" />Delete?</> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <NoteEditor
                key={selectedNote.id}
                ref={noteEditorRef}
                content={selectedNote.content}
                onChange={handleContentChange}
                editable={canEditSelectedNote}
              >
                <div className="mx-auto max-w-[44rem] px-6 pt-10 sm:px-10">
                  <textarea
                    value={selectedNote.title || ""}
                    onChange={handleTitleChange}
                    readOnly={!canEditSelectedNote}
                    placeholder="Untitled"
                    aria-label="Note title"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        noteEditorRef.current?.focus?.();
                      }
                    }}
                    className="block w-full resize-none border-none bg-transparent p-0 font-serif text-[2.5rem] leading-[1.1] tracking-[-0.01em] text-heading outline-none [field-sizing:content] placeholder:text-placeholder"
                  />
                  <p className="mb-6 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {selectedNote.project_id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: selectedNote.project_color || "var(--neutral-400)" }} />
                        {selectedNote.project_name || "Project"}
                      </span>
                    ) : null}
                    <span>{visibilityLabel}</span>
                    {selectedNote.notebook_name && <span>· {selectedNote.notebook_name}</span>}
                    {selectedNote.updated_at && <span className="font-mono">· Edited {formatDate(selectedNote.updated_at)}</span>}
                  </p>
                </div>
              </NoteEditor>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex h-11 shrink-0 items-center border-b border-border px-3">{panelToggle}</div>
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={<NotebookPen />}
                title="Nothing open"
                description="Pick a note from the list, or start a fresh page."
                action={{ children: "New note", onClick: handleNewBlankNote, leftIcon: <Plus /> }}
              />
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showTemplates} onClose={() => setShowTemplates(false)} title="Start from a template" size="md">
        <TemplateSelector onSelect={handleCreateWithTemplate} />
      </Modal>
    </div>
  );
}
