"use client";

import { useState } from "react";

/**
 * Draft state for the panel-based collection editors (milestones, targets,
 * leads). `field(name)` binds an input to a draft property.
 */
export function useCollectionEditor(collection, canSave) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!draft || !canSave(draft) || saving) return;
    setSaving(true);
    try {
      await collection.save(draft);
      setDraft(null);
    } catch (error) {
      collection.setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item, question) => {
    if (!window.confirm(question)) return;
    try { await collection.remove(item); } catch (error) { collection.setError(error.message); }
  };

  const field = (name) => ({
    value: draft?.[name] ?? "",
    onChange: (event) => setDraft((current) => ({ ...current, [name]: event.target.value })),
  });

  return { draft, setDraft, saving, submit, remove, field, canSave: Boolean(draft) && canSave(draft) };
}
