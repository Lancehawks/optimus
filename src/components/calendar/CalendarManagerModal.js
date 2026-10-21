"use client";

import { useState } from "react";
import { Link2, Pencil, Trash2, Unlink } from "lucide-react";
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

  const swatch = (color, active, onPick, size = "h-5 w-5") => (
    <button
      key={color}
      type="button"
      onClick={onPick}
      aria-label={`Colour ${color}`}
      aria-pressed={active}
      className={cn(size, "cursor-pointer rounded-full transition-transform hover:scale-110", active && "ring-2 ring-heading ring-offset-2 ring-offset-surface")}
      style={{ backgroundColor: color }}
    />
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Calendars" description="Choose which calendars you keep in Optimus." size="md">
      <div className="space-y-6">
        <div className="divide-y divide-border rounded-lg border border-border">
          {calendars.map((cal) => (
            <div key={cal.id}>
              {editingId === cal.id ? (
                <div className="space-y-3 bg-surface-secondary p-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} size="sm" aria-label="Calendar name" />
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1.5">
                      {PRESET_COLORS.map((color) => swatch(color, editColor === color, () => setEditColor(color)))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={handleUpdate} isLoading={isLoading}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-3 px-3 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ backgroundColor: cal.color }} />
                  <span className="flex-1 truncate text-sm text-heading">{cal.name}</span>
                  {cal.is_google && <span className="badge bg-surface-tertiary text-muted">Google</span>}
                  {cal.is_default && <span className="badge bg-surface-tertiary text-muted">Default</span>}
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    {!cal.is_google && (
                      <button type="button" onClick={() => startEditing(cal)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading" aria-label={`Edit ${cal.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(cal)}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-danger-light hover:text-danger"
                      title={cal.is_google ? "Remove from Optimus" : "Delete calendar"}
                      aria-label={cal.is_google ? `Remove ${cal.name}` : `Delete ${cal.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <section>
          <h4 className="mb-2 text-overline">New calendar</h4>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Calendar name"
              size="sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button size="sm" onClick={handleCreate} isLoading={isLoading}>Add</Button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {PRESET_COLORS.map((color) => swatch(color, newColor === color, () => setNewColor(color)))}
          </div>
        </section>

        <section className="border-t border-border pt-5">
          <h4 className="mb-2 text-overline">Google Calendar</h4>
          {googleConnected ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Unlink />}
              className="text-danger! hover:bg-danger-light!"
              onClick={() => {
                if (confirm("Disconnect Google Calendar? All synced calendars and events will be removed.")) {
                  onGoogleDisconnect?.();
                }
              }}
            >
              Disconnect Google Calendar
            </Button>
          ) : (
            <Button variant="secondary" size="sm" leftIcon={<Link2 />} onClick={onGoogleConnect}>
              Connect Google Calendar
            </Button>
          )}
        </section>
      </div>
    </Modal>
  );
}
