"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EVENT_COLOR_OPTIONS } from "@/lib/eventDisplay";
import { useToast, Modal, Button, Input } from "@/components/ui";

const PRESET_COLORS = EVENT_COLOR_OPTIONS.map((color) => color.value);

export default function CalendarManagerModal({
  isOpen,
  onClose,
  calendars,
  onCreate,
  onUpdate,
  onDelete,
  isLoading,
  googleConnected,
  onGoogleConnect,
  onGoogleDisconnect,
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
    const msg = cal.is_google
      ? `Remove "${cal.name}" from the app? It will re-appear on next sync.`
      : `Delete "${cal.name}" and all its events?`;
    if (!confirm(msg)) return;
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
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!cal.is_google && (
                      <button
                        type="button"
                        onClick={() => startEditing(cal)}
                        className="text-muted hover:text-body p-1 cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(cal)}
                      className="text-muted hover:text-danger p-1 cursor-pointer"
                      title={cal.is_google ? "Remove from app" : "Delete calendar"}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
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

        {/* Google Calendar section */}
        <div className="border-t border-border-light pt-4">
          <h4 className="text-caption font-medium text-heading mb-2">Google Calendar</h4>
          {googleConnected ? (
            <button
              type="button"
              onClick={() => {
                if (confirm("Disconnect Google Calendar? All synced calendars and events will be removed.")) {
                  onGoogleDisconnect?.();
                }
              }}
              className="flex items-center gap-2 text-body-sm text-danger hover:text-danger-hover cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.181 8.68a4.503 4.503 0 011.903 6.405m-9.768-2.782L3.56 14.06a4.5 4.5 0 006.364 6.365l.457-.456a1.5 1.5 0 012.122 0l.457.456a4.5 4.5 0 006.364-6.365l-1.757-1.757m-9.768-2.782a4.5 4.5 0 016.364 0" />
              </svg>
              Disconnect Google Calendar
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleConnect}
              className="flex items-center gap-2 text-body-sm text-muted hover:text-body cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
