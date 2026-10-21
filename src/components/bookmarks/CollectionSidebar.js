"use client";

import { useState } from "react";
import { ArrowLeft, Folder, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input, useToast } from "@/components/ui";

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

  const itemClass = (active) =>
    cn(
      "flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
      active ? "bg-surface-tertiary font-medium text-heading" : "text-body hover:bg-surface-secondary hover:text-heading"
    );

  return (
    <div className={cn("shrink-0", className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-heading lg:hidden"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to links
        </button>
      )}

      <div className="mb-1.5 flex h-7 items-center justify-between pl-2">
        <h3 className="text-overline">Collections</h3>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
          title="New collection"
          aria-label="New collection"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {isCreating && (
        <div className="mb-2 space-y-1.5">
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
          <div className="flex gap-1">
            <Button size="xs" onClick={handleCreate} className="flex-1">Create</Button>
            <Button size="xs" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => onSelectCollection(null)} className={itemClass(selectedCollectionId === null)}>
        <Inbox className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
        All links
      </button>

      <div className="mt-0.5 space-y-0.5">
        {collections.map((collection) => (
          <div key={collection.id} className="group relative">
            {editingId === collection.id ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                size="sm"
                autoFocus
                aria-label="Collection name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(collection.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => handleRename(collection.id)}
              />
            ) : (
              <>
                <button type="button" onClick={() => onSelectCollection(collection.id)} className={itemClass(selectedCollectionId === collection.id)}>
                  <Folder className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{collection.name}</span>
                  {collection.bookmark_count !== undefined && (
                    <span className="font-mono text-[0.6875rem] text-muted group-hover:invisible">{collection.bookmark_count}</span>
                  )}
                </button>
                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center group-hover:flex">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(collection.id);
                      setEditName(collection.name);
                    }}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-heading"
                    aria-label={`Rename ${collection.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(collection.id)}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted hover:text-danger"
                    aria-label={`Delete ${collection.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
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
