"use client";

import { useState, useRef, useEffect } from "react";
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

  return (
    <div className="w-56 shrink-0 border-r border-border bg-surface overflow-y-auto scrollbar-thin">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-overline">Notebooks</h3>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="btn-ghost p-1 rounded-sm cursor-pointer"
            title="New notebook"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* New notebook input */}
        {isCreating && (
          <div className="mb-2">
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
            <div className="flex gap-1 mt-1.5">
              <Button size="sm" onClick={handleCreate} className="flex-1">Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* All Notes */}
        <button
          onClick={() => onSelectNotebook(null)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium transition-colors cursor-pointer mb-1",
            selectedNotebookId === null
              ? "bg-brand-500/10 text-brand-400!"
              : "text-muted! hover:bg-surface-tertiary hover:text-heading!"
          )}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          All Notes
        </button>

        {/* Notebook list */}
        <div className="space-y-0.5">
          {notebooks.map((notebook) => (
            <div key={notebook.id} className="group">
              {editingId === notebook.id ? (
                <div className="px-1 py-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    size="sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(notebook.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleRename(notebook.id)}
                  />
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    onClick={() => onSelectNotebook(notebook.id)}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium transition-colors cursor-pointer text-left",
                      selectedNotebookId === notebook.id
                        ? "bg-brand-500/10 text-brand-400!"
                        : "text-muted! hover:bg-surface-tertiary hover:text-heading!"
                    )}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className="truncate flex-1">{notebook.name}</span>
                    <span className="text-caption">{notebook.note_count}</span>
                  </button>

                  {/* Actions */}
                  <div className="hidden group-hover:flex items-center shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(notebook.id);
                        setEditName(notebook.name);
                      }}
                      className="p-1 text-muted hover:text-heading cursor-pointer"
                      title="Rename"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(notebook.id)}
                      title={confirmingDeleteId === notebook.id ? "Click again to confirm" : "Delete notebook"}
                      className={cn(
                        "p-1 rounded-md transition-all cursor-pointer",
                        confirmingDeleteId === notebook.id
                          ? "text-red-400 bg-red-500/10"
                          : "text-muted hover:text-danger"
                      )}
                    >
                      {confirmingDeleteId === notebook.id ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
