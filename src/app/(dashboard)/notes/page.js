"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { Badge, Button, EmptyState, ErrorState, Modal, SearchBox, Spinner, useToast } from "@/components/ui";
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
  loading: () => <div className="flex min-h-64 items-center justify-center"><Spinner size="lg" /></div>,
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

  selectedNoteIdRef.current = selectedNote?.id || null;

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
  updateNoteRef.current = updateNote;

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

  return (
    <div className="flex h-[calc(100dvh-56px)] lg:h-[calc(100vh-64px)]">

      {/* ── Pane 1: Notebooks sidebar — desktop only ── */}
      <div
        style={{ width: panelsOpen ? "224px" : "0px" }}
        className="hidden lg:block shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
      >
        {notebooksError ? (
          <ErrorState
            compact
            className="h-full rounded-none border-x-0 border-y-0"
            title="Notebooks unavailable"
            description="Retry to load your notebooks."
            onRetry={refetchNotebooks}
          />
        ) : <NotebookSidebar
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
        />}
      </div>

      {/* ── Pane 2: Note list ── */}
      <div
        style={{ width: isMobile ? undefined : (panelsOpen ? "320px" : "0px") }}
        className={cn(
          "shrink-0 overflow-hidden border-r border-border",
          "lg:transition-[width] lg:duration-200 lg:ease-in-out",
          // Mobile: full width, shown only in list pane
          mobilePane === "list" ? "flex flex-col w-full lg:w-auto" : "hidden lg:block"
        )}
      >
      <div className="w-full lg:w-80 flex flex-col min-h-0 h-full">

        {/* List header */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="text-h4">Notes</h2>
              <p className="text-caption text-muted mt-0.5">
                {pagination.filteredCount || 0} note{pagination.filteredCount !== 1 ? "s" : ""}
                {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Template picker */}
              <button
                onClick={() => setShowTemplates(true)}
                className="p-1.5 rounded-lg btn-ghost text-muted cursor-pointer"
                title="New from template"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
              {/* New blank note — instant, no modal */}
              <button
                onClick={handleNewBlankNote}
                className="p-1.5 rounded-lg btn-primary cursor-pointer"
                title="New note"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search — debounced */}
          <SearchBox
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search notes..."
            className="w-full"
          />

          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-caption text-heading outline-none cursor-pointer transition-colors hover:border-border-strong"
            >
              <option value="">All notes</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          )}

          {/* Tabs — compact for narrow panel */}
          <div className="mt-2 flex gap-1">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  activeTab === tab.key
                    ? "bg-brand-500/15 text-brand-400"
                    : "text-muted hover:text-heading hover:bg-surface-tertiary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : error && notes.length === 0 ? (
            <ErrorState
              compact
              title="Notes couldn't be loaded"
              description={error.message || "Check your connection and try again."}
              onRetry={refetch}
            />
          ) : activeTab === "journals" ? (
            <>
              {error && (
                <ErrorState
                  compact
                  title="Some notes may be missing"
                  description={error.message || "The latest notes couldn't be loaded."}
                  onRetry={refetch}
                />
              )}
              <div className="p-3">
                <JournalView
                  notes={notes}
                  onSelectNote={handleSelectNote}
                  onCreateJournalEntry={handleCreateJournalEntry}
                />
              </div>
              <LoadMoreButton hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} />
            </>
          ) : (
            <>
              {error && (
                <ErrorState
                  compact
                  title="Some notes may be missing"
                  description={error.message || "The latest notes couldn't be loaded."}
                  onRetry={refetch}
                />
              )}
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

      {/* ── Pane 3: Editor ── */}
      <div className={cn(
        "flex-1 flex-col min-w-0 min-h-0",
        mobilePane === "editor" ? "flex" : "hidden lg:flex"
      )}>
        {selectedNote ? (
          // key forces remount + fade-in animation on note switch
          <div key={selectedNote.id} className="flex flex-col h-full animate-fade-in">

            {/* Editor header: save status + actions */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                {/* Mobile back button */}
                <button
                  onClick={() => setMobilePane("list")}
                  className="lg:hidden p-2.5 -ml-1 rounded-lg btn-ghost text-muted cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Back to notes list"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                {/* Panel collapse toggle — desktop only */}
                <button
                  onClick={() => setPanelsOpen((p) => !p)}
                  title={panelsOpen ? "Hide panels" : "Show panels"}
                  className="hidden lg:flex p-1.5 rounded-lg btn-ghost text-muted cursor-pointer shrink-0 items-center justify-center"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    {panelsOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                    )}
                  </svg>
                </button>
              {/* Save status indicator */}
              <div className="h-5 flex items-center">
                {saveStatus === "saving" && (
                  <span className="text-caption text-muted flex items-center gap-1.5 animate-fade-in">
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="text-caption text-success flex items-center gap-1.5 animate-fade-in">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Saved
                  </span>
                )}
                {saveStatus === "error" && (
                  <button
                    type="button"
                    onClick={retryFailedSave}
                    className="text-caption text-danger flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-danger-light cursor-pointer animate-fade-in"
                    title="Retry saving your latest changes"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-.582 14.124A9 9 0 105.64 5.64L3 8.25m18 7.5-2.64 2.61" />
                    </svg>
                    Not saved · Retry
                  </button>
                )}
              </div>
              </div>{/* end left flex group */}

              {/* Pin + Delete */}
              <div className="flex items-center gap-1">
                {canEditSelectedNote && (
                  <button
                    onClick={handleTogglePin}
                    title={selectedNote.is_pinned ? "Unpin note" : "Pin note"}
                    className={cn(
                      "p-1.5 rounded-lg btn-ghost cursor-pointer transition-colors",
                      selectedNote.is_pinned ? "text-amber-500" : "text-muted"
                    )}
                  >
                    <svg className="h-4 w-4" fill={selectedNote.is_pinned ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                    </svg>
                  </button>
                )}
                {canDeleteSelectedNote && (
                  <button
                    onClick={handleDeleteClick}
                    title={confirmingDelete ? "Click again to confirm deletion" : "Delete note"}
                    className={cn(
                      "p-1.5 rounded-lg cursor-pointer transition-all",
                      confirmingDelete
                        ? "text-red-400 bg-red-500/15"
                        : "btn-ghost text-muted hover:text-danger"
                    )}
                  >
                    {confirmingDelete ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="px-8 pt-6 shrink-0">
              <input
                type="text"
                value={selectedNote.title || ""}
                onChange={handleTitleChange}
                readOnly={!canEditSelectedNote}
                placeholder="Untitled"
                className="w-full text-h2 text-heading! bg-transparent border-none outline-none placeholder:text-disabled focus-visible:shadow-none!"
              />
            </div>

            {/* Metadata bar — notebook + last edited */}
            <div className="px-8 pt-1.5 pb-1 flex items-center gap-2 shrink-0 flex-wrap">
              {selectedNote.project_id ? (
                <>
                  <Badge variant="info" size="sm">Shared project</Badge>
                  <span
                    className="inline-flex text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: (selectedNote.project_color || "#0d6b88") + "20", color: selectedNote.project_color || "#0d6b88" }}
                  >
                    {selectedNote.project_name || "Project"}
                  </span>
                </>
              ) : (
                <Badge variant="neutral" size="sm">Personal</Badge>
              )}
              {selectedNote.notebook_name && (
                <span className="text-caption text-muted flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  {selectedNote.notebook_name}
                </span>
              )}
              {selectedNote.updated_at && (
                <>
                  {selectedNote.notebook_name && <span className="text-caption text-muted">·</span>}
                  <span className="text-caption text-muted">
                    Last edited {formatDate(selectedNote.updated_at)}
                  </span>
                </>
              )}
              <span className="text-caption text-muted">·</span>
              <select
                value={selectedNote.project_id || ""}
                onChange={(e) => handleProjectChange(e.target.value)}
                disabled={!canEditSelectedNote}
                className={cn(
                  "text-caption text-muted bg-transparent border-none outline-none transition-colors",
                  canEditSelectedNote ? "cursor-pointer hover:text-heading" : "cursor-default opacity-70"
                )}
              >
                <option value="">Personal</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="px-8 pb-3 shrink-0">
              <p className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-caption text-muted!">
                {selectedNote.project_id
                  ? `This note is shared with ${selectedNoteProjectMemberCount} project member${selectedNoteProjectMemberCount === 1 ? "" : "s"}.`
                  : "Personal note. Only you can see it."}
              </p>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <NoteEditor
                key={selectedNote.id}
                ref={noteEditorRef}
                content={selectedNote.content}
                onChange={handleContentChange}
                editable={canEditSelectedNote}
              />
            </div>
          </div>
        ) : (
          /* No note selected — empty state */
          <div className="flex flex-col h-full">
            <div className="px-4 py-2.5 border-b border-border shrink-0">
              <button
                onClick={() => setPanelsOpen((p) => !p)}
                title={panelsOpen ? "Hide panels" : "Show panels"}
                className="hidden lg:flex p-1.5 rounded-lg btn-ghost text-muted cursor-pointer items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  {panelsOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                  )}
                </svg>
              </button>
            </div>
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              }
              title="No note open"
              description="Select a note from the list, or create a new one."
              action={{ children: "New Note", onClick: handleNewBlankNote }}
            />
          </div>
          </div>
        )}
      </div>

      {/* Template selector modal */}
      <Modal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        title="Choose a template"
        size="sm"
      >
        <TemplateSelector onSelect={handleCreateWithTemplate} />
      </Modal>
    </div>
  );
}
