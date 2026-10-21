"use client";

import { useState, useRef, useEffect } from "react";
import { Book, Layers, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, useToast } from "@/components/ui";

export default function NotebookSidebar({
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const deleteTimerRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => () => clearTimeout(deleteTimerRef.current), []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await onCreateNotebook(newName.trim());
      setNewName("");
      setIsCreating(false);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    try {
      await onRenameNotebook(id, editName.trim());
      setEditingId(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDeleteNotebook(id);
      if (selectedNotebookId === id) {
        onSelectNotebook(null);
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDeleteClick = (id) => {
    if (confirmingDeleteId === id) {
      clearTimeout(deleteTimerRef.current);
      setConfirmingDeleteId(null);
      handleDelete(id);
    } else {
      setConfirmingDeleteId(id);
      deleteTimerRef.current = setTimeout(() => setConfirmingDeleteId(null), 3000);
    }
  };

  const itemClass = (active) =>
    cn(
      "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
      active ? "bg-surface font-medium text-heading shadow-sm ring-1 ring-black/[0.04]" : "text-body hover:bg-black/[0.035] hover:text-heading dark:hover:bg-white/[0.05]"
    );

  return (
    <div className="h-full w-[13.5rem] overflow-y-auto p-3 scrollbar-thin">
      <div className="mb-2 flex h-7 items-center justify-between pl-2">
        <h3 className="text-overline">Notebooks</h3>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
          title="New notebook"
          aria-label="New notebook"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {isCreating && (
        <div className="mb-2 space-y-1.5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Notebook name"
            size="sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          <div className="flex gap-1">
            <Button size="xs" onClick={handleCreate} className="flex-1">Create</Button>
            <Button size="xs" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => onSelectNotebook(null)} className={itemClass(selectedNotebookId === null)}>
        <Layers className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
        All notes
      </button>

      <div className="mt-0.5 space-y-0.5">
        {notebooks.map((notebook) => (
          <div key={notebook.id} className="group relative">
            {editingId === notebook.id ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                size="sm"
                autoFocus
                aria-label="Notebook name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(notebook.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => handleRename(notebook.id)}
              />
            ) : (
              <>
                <button type="button" onClick={() => onSelectNotebook(notebook.id)} className={itemClass(selectedNotebookId === notebook.id)}>
                  <Book className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{notebook.name}</span>
                  <span className="font-mono text-[0.6875rem] text-muted group-hover:invisible">{notebook.note_count}</span>
                </button>
                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center group-hover:flex">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(notebook.id);
                      setEditName(notebook.name);
                    }}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-heading"
                    title="Rename"
                    aria-label={`Rename ${notebook.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(notebook.id)}
                    title={confirmingDeleteId === notebook.id ? "Click again to delete" : "Delete notebook"}
                    aria-label={confirmingDeleteId === notebook.id ? "Confirm delete" : `Delete ${notebook.name}`}
                    className={cn(
                      "flex h-6 w-6 cursor-pointer items-center justify-center rounded",
                      confirmingDeleteId === notebook.id ? "bg-danger-light text-danger" : "text-muted hover:text-danger"
                    )}
                  >
                    {confirmingDeleteId === notebook.id ? <TriangleAlert className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
