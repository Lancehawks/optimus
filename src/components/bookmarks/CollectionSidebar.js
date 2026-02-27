"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui";

export default function CollectionSidebar({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  className,
  onBack,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const { addToast } = useToast();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await onCreateCollection(newName.trim());
      setNewName("");
      setIsCreating(false);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    try {
      await onRenameCollection(id, editName.trim());
      setEditingId(null);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDeleteCollection(id);
      if (selectedCollectionId === id) {
        onSelectCollection(null);
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  };

  return (
    <div className={cn("w-56 shrink-0 border-r border-border bg-surface overflow-y-auto scrollbar-thin", className)}>
      <div className="p-3">
        {/* Mobile back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden flex items-center gap-2 text-muted hover:text-heading mb-3 cursor-pointer text-body-sm w-full"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Reading List
          </button>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-overline">Collections</h3>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="btn-ghost p-1 rounded-sm cursor-pointer"
            title="New collection"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* New collection input */}
        {isCreating && (
          <div className="mb-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
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

        {/* All Bookmarks */}
        <button
          onClick={() => onSelectCollection(null)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium transition-colors cursor-pointer mb-1",
            selectedCollectionId === null
              ? "bg-brand-500/10 text-brand-400!"
              : "text-muted! hover:bg-surface-tertiary hover:text-heading!"
          )}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          All Bookmarks
        </button>

        {/* Collection list */}
        <div className="space-y-0.5">
          {collections.map((collection) => (
            <div key={collection.id} className="group">
              {editingId === collection.id ? (
                <div className="px-1 py-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    size="sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(collection.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => handleRename(collection.id)}
                  />
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    onClick={() => onSelectCollection(collection.id)}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm font-medium transition-colors cursor-pointer text-left",
                      selectedCollectionId === collection.id
                        ? "bg-brand-500/10 text-brand-400!"
                        : "text-muted! hover:bg-surface-tertiary hover:text-heading!"
                    )}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className="truncate flex-1">{collection.name}</span>
                    <span className="text-caption">{collection.bookmark_count}</span>
                  </button>

                  {/* Actions */}
                  <div className="hidden group-hover:flex items-center shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(collection.id);
                        setEditName(collection.name);
                      }}
                      className="p-1 text-muted hover:text-heading cursor-pointer"
                      title="Rename"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(collection.id)}
                      className="p-1 text-muted hover:text-danger cursor-pointer"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
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
