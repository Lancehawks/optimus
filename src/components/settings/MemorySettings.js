"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { assistantService } from "@/services/api";

const MAX_LENGTH = 500;
const PLACEHOLDER = "e.g. I'm a product designer. I plan my week on Monday mornings and prefer short answers with the most urgent thing first.";

function MemoryEditor({ initial = "", submitLabel, onSubmit, onCancel, autoFocus = false }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const trimmed = value.trim();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      if (!onCancel) setValue("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={MAX_LENGTH}
        rows={3}
        autoFocus={autoFocus}
        placeholder={onCancel ? undefined : PLACEHOLDER}
        aria-label={onCancel ? "Edit memory" : "New memory"}
        className="input-base focus:input-focus resize-y leading-5!"
      />
      <div className="flex items-center gap-2">
        <span className="mr-auto font-mono text-[0.6875rem] tabular-nums text-muted">{value.length}/{MAX_LENGTH}</span>
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>}
        <Button type="submit" size="sm" variant={onCancel ? "primary" : "secondary"} isLoading={saving} disabled={!trimmed}>
          {submitLabel}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </form>
  );
}

export default function MemorySettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [memories, setMemories] = useState(null);
  const [limit, setLimit] = useState(50);
  const [loadError, setLoadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await assistantService.listMemories();
      setMemories(data.memories);
      setLimit(data.limit);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (content) => {
    const data = await assistantService.addMemory(content);
    setMemories((current) => [...(current || []), data.memory]);
  };

  const save = async (id, content) => {
    const data = await assistantService.updateMemory(id, content);
    setMemories((current) => current.map((memory) => (memory.id === id ? data.memory : memory)));
    setEditingId(null);
  };

  const remove = async (id) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    try {
      await assistantService.deleteMemory(id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setConfirmingId(null);
    }
  };

  if (loadError) {
    return (
      <p className="text-sm text-danger">
        {loadError}{" "}
        <button type="button" onClick={load} className="cursor-pointer font-medium underline underline-offset-4">Try again</button>
      </p>
    );
  }
  if (!memories) return <div className="skeleton h-24" />;

  const full = memories.length >= limit;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted">
        Add things like your role, what you&apos;re focused on, how you plan your days, or how you like answers. Changes
        apply to new conversations.
        {!user?.ai_assistant_enabled_at && " The assistant is off for you, so nothing is sent until an admin turns it on."}
      </p>

      {memories.length > 0 && (
        <ul className="card divide-y divide-border">
          {memories.map((memory) => (
            <li key={memory.id} className="px-4 py-3">
              {editingId === memory.id ? (
                <MemoryEditor
                  initial={memory.content}
                  submitLabel="Save"
                  autoFocus
                  onSubmit={(content) => save(memory.id, content)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-body">{memory.content}</p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => { setEditingId(memory.id); setConfirmingId(null); }}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"
                      aria-label="Edit memory"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(memory.id)}
                      onBlur={() => setConfirmingId((current) => (current === memory.id ? null : current))}
                      className={confirmingId === memory.id
                        ? "flex h-7 cursor-pointer items-center rounded-md bg-danger-light px-2 text-xs font-medium text-danger"
                        : "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-tertiary hover:text-heading"}
                      aria-label={confirmingId === memory.id ? "Confirm delete" : "Delete memory"}
                    >
                      {confirmingId === memory.id ? "Delete" : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-sm text-muted">You&apos;ve reached {limit} memories. Remove one to add another.</p>
      ) : (
        <MemoryEditor submitLabel="Add memory" onSubmit={add} />
      )}
      <p className="font-mono text-[0.6875rem] tabular-nums text-muted">{memories.length} of {limit}</p>
    </div>
  );
}
