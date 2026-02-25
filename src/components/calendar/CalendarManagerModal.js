"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useToast, Modal, Button, Input } from "@/components/ui";

const PRESET_COLORS = [
  "#6366f1", "#f43f5e", "#22c55e", "#3b82f6",
  "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6",
  "#ef4444", "#06b6d4",
];

export default function CalendarManagerModal({
  isOpen,
  onClose,
  calendars,
  onCreate,
  onUpdate,
  onDelete,
  isLoading,
}) {
  const { addToast } = useToast();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  async function handleCreate() {
    if (!newName.trim()) {
      addToast({ message: "Calendar name is required", type: "error" });
      return;
    }
    await onCreate?.({ name: newName.trim(), color: newColor });
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
  }

  function startEditing(cal) {
    setEditingId(cal.id);
    setEditName(cal.name);
    setEditColor(cal.color);
  }

  async function handleUpdate() {
    if (!editName.trim()) return;
    await onUpdate?.(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  }

  async function handleDelete(cal) {
    const localCalendars = calendars.filter((c) => !c.is_google);
    if (localCalendars.length <= 1 && !cal.is_google) {
      addToast({ message: "Cannot delete your only local calendar", type: "error" });
      return;
    }
    if (!confirm(`Delete "${cal.name}" and all its events?`)) return;
    await onDelete?.(cal.id);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Calendars"
      size="md"
    >
      <div className="space-y-4">
        {/* Existing calendars */}
        <div className="space-y-2">
          {calendars.map((cal) => (
            <div key={cal.id}>
              {editingId === cal.id ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-tertiary">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    size="sm"
                    className="flex-1"
                  />
                  <div className="flex gap-1 shrink-0">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={cn(
                          "w-5 h-5 rounded-full cursor-pointer transition-transform",
                          editColor === color && "ring-2 ring-white ring-offset-1 ring-offset-neutral-800 scale-110"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Button size="sm" onClick={handleUpdate} isLoading={isLoading}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-tertiary group">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: cal.color }}
                  />
                  <span className="text-body-sm flex-1">{cal.name}</span>
                  {cal.is_google && (
                    <span className="text-[10px] text-muted bg-surface-tertiary px-1.5 py-0.5 rounded">
                      Google
                    </span>
                  )}
                  {cal.is_default && (
                    <span className="text-[10px] text-muted bg-surface-tertiary px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  {!cal.is_google && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => startEditing(cal)}
                        className="text-muted hover:text-body p-1 cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cal)}
                        className="text-muted hover:text-danger p-1 cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new calendar */}
        <div className="border-t border-border-light pt-4">
          <h4 className="text-caption font-medium text-heading mb-2">Add Calendar</h4>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Calendar name"
              size="sm"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button size="sm" onClick={handleCreate} isLoading={isLoading}>
              Add
            </Button>
          </div>
          {/* Color picker */}
          <div className="flex gap-1.5 mt-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={cn(
                  "w-6 h-6 rounded-full cursor-pointer transition-transform",
                  newColor === color && "ring-2 ring-white ring-offset-1 ring-offset-neutral-800 scale-110"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
