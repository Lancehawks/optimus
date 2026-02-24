"use client";

import { useState, useCallback } from "react";
import { Button, Tabs, SearchBox, Spinner, Modal } from "@/components/ui";
import { useToast } from "@/components/ui";
import { useNotes, useNoteMutations, useNotebooks } from "@/hooks/useNotes";
import { noteService } from "@/services/api";
import NoteEditor from "@/components/notes/NoteEditor";
import NotebookSidebar from "@/components/notes/NotebookSidebar";
import NoteList from "@/components/notes/NoteList";
import JournalView from "@/components/notes/JournalView";
import TemplateSelector, { templates } from "@/components/notes/TemplateSelector";

const viewTabs = [
  { key: "all", label: "All Notes" },
  { key: "journals", label: "Journals" },
  { key: "pinned", label: "Pinned" },
];

export default function NotesPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedNotebookId, setSelectedNotebookId] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const { addToast } = useToast();

  const filters = {
    ...(selectedNotebookId ? { notebook_id: selectedNotebookId } : {}),
    ...(activeTab === "journals" ? { is_journal: "true" } : {}),
    ...(activeTab === "pinned" ? { is_pinned: "true" } : {}),
    ...(search ? { search } : {}),
  };

  const { notes, isLoading, refetch } = useNotes(filters);
  const { createNote, updateNote, deleteNote, togglePin } = useNoteMutations(refetch);
  const { notebooks, createNotebook, updateNotebook, deleteNotebook } = useNotebooks();

  const handleSelectNote = useCallback(async (note) => {
    try {
      const data = await noteService.get(note.id);
      setSelectedNote(data.note);
      setIsEditing(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }, [addToast]);

  const handleNewNote = (template = null) => {
    if (template) {
      handleCreateWithTemplate(template);
    } else {
      setShowTemplates(true);
    }
  };

  const handleCreateWithTemplate = async (template) => {
    try {
      const note = await createNote({
        title: template.name === "blank" ? "Untitled" : template.label,
        content: template.content,
        notebookId: selectedNotebookId,
        templateName: template.name,
      });
      setSelectedNote(note);
      setIsEditing(true);
      setShowTemplates(false);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleCreateJournalEntry = async (dateStr) => {
    const reflectionTemplate = templates.find((t) => t.name === "daily_reflection");
    try {
      const note = await createNote({
        title: `Journal — ${new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
        content: reflectionTemplate?.content || "",
        isJournal: true,
        journalDate: dateStr,
        templateName: "daily_reflection",
      });
      setSelectedNote(note);
      setIsEditing(true);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleContentChange = useCallback(async (content) => {
    if (!selectedNote) return;
    try {
      await updateNote(selectedNote.id, { content });
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, [selectedNote, updateNote]);

  const handleTitleChange = useCallback(async (e) => {
    const title = e.target.value;
    setSelectedNote((prev) => ({ ...prev, title }));
    if (selectedNote?.id) {
      try {
        await updateNote(selectedNote.id, { title });
      } catch (error) {
        console.error("Title save failed:", error);
      }
    }
  }, [selectedNote, updateNote]);

  const handleTogglePin = async () => {
    if (!selectedNote) return;
    try {
      const updated = await togglePin(selectedNote.id, selectedNote.is_pinned);
      setSelectedNote(updated);
      addToast({ message: updated.is_pinned ? "Note pinned" : "Note unpinned", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    try {
      await deleteNote(selectedNote.id);
      setSelectedNote(null);
      setIsEditing(false);
      addToast({ message: "Note deleted", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleBackToList = () => {
    setSelectedNote(null);
    setIsEditing(false);
    refetch();
  };

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Notebook sidebar */}
      <NotebookSidebar
        notebooks={notebooks}
        selectedNotebookId={selectedNotebookId}
        onSelectNotebook={(id) => {
          setSelectedNotebookId(id);
          setSelectedNote(null);
          setIsEditing(false);
        }}
        onCreateNotebook={createNotebook}
        onRenameNotebook={updateNotebook}
        onDeleteNotebook={deleteNotebook}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {isEditing && selectedNote ? (
          /* Editor view */
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <button
                onClick={handleBackToList}
                className="btn-ghost p-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 text-body-sm text-muted"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleTogglePin}
                  className={`btn-ghost p-1.5 rounded-lg cursor-pointer ${
                    selectedNote.is_pinned ? "text-amber-500" : "text-muted"
                  }`}
                  title={selectedNote.is_pinned ? "Unpin" : "Pin"}
                >
                  <svg className="h-4 w-4" fill={selectedNote.is_pinned ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                </button>
                <button
                  onClick={handleDeleteNote}
                  className="btn-ghost p-1.5 rounded-lg cursor-pointer text-muted hover:text-danger"
                  title="Delete note"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="px-6 pt-4 shrink-0">
              <input
                type="text"
                value={selectedNote.title || ""}
                onChange={handleTitleChange}
                placeholder="Untitled"
                className="w-full text-h2 text-heading! bg-transparent border-none outline-none placeholder:text-disabled"
              />
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <NoteEditor
                content={selectedNote.content}
                onChange={handleContentChange}
              />
            </div>
          </>
        ) : (
          /* List view */
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-h1">Notes</h1>
                <Button
                  onClick={() => handleNewNote()}
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  }
                >
                  New Note
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <SearchBox
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="sm:max-w-xs"
                />
                <Tabs tabs={viewTabs} activeTab={activeTab} onChange={setActiveTab} className="sm:ml-auto" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : activeTab === "journals" ? (
                <div className="p-6 max-w-md mx-auto">
                  <JournalView
                    notes={notes}
                    onSelectNote={handleSelectNote}
                    onCreateJournalEntry={handleCreateJournalEntry}
                  />
                </div>
              ) : (
                <NoteList
                  notes={notes}
                  selectedNoteId={selectedNote?.id}
                  onSelectNote={handleSelectNote}
                />
              )}
            </div>
          </>
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
