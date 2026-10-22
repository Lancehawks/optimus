"use client";

import { useEffect, useState } from "react";
import { Button, Toggle, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { assistantService } from "@/services/api";
import { formatDate } from "@/lib/utils";

export default function AssistantSettings() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const enabledAt = user?.ai_assistant_enabled_at || null;
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    assistantService.getSettings()
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (next) => {
    setSaving(true);
    try {
      const data = await assistantService.setEnabled(next);
      updateUser({ ...user, ai_assistant_enabled_at: data.enabledAt });
      addToast({ message: next ? "Assistant turned on" : "Assistant turned off", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistory = async () => {
    setDeleting(true);
    try {
      await assistantService.deleteAllConversations();
      addToast({ message: "Assistant history deleted", type: "success" });
      setConfirmingDelete(false);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Toggle checked={Boolean(enabledAt)} onChange={handleToggle} disabled={saving} label="Use the assistant" />
        <p className="mt-1.5 pl-[2.875rem] font-mono text-[0.6875rem] text-muted">
          {enabledAt ? `On since ${formatDate(enabledAt)}` : "Off"}
          {info?.model ? ` · ${info.model}` : ""}
        </p>
      </div>

      <div className="space-y-2 text-sm leading-6 text-body">
        <p>
          When it&apos;s on, your questions and the workspace items the assistant looks up to answer them are sent to
          Anthropic to write each reply. That can include tasks, events, notes, projects and routines, including items in
          shared projects you can see. Nothing is sent while it&apos;s off.
        </p>
        <p className="text-muted">
          It can read your workspace but can&apos;t change it. Conversations are kept until you delete them, including
          after you turn the assistant off.
        </p>
      </div>

      {info && !info.available && (
        <p className="rounded-lg bg-warning-light px-3 py-2 text-xs text-body">
          The assistant isn&apos;t set up on this server yet, so it can&apos;t answer until an administrator adds the API key.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-sm text-body">Delete every assistant conversation?</span>
            <Button variant="danger" size="sm" isLoading={deleting} onClick={handleDeleteHistory}>Delete all</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(true)}>Delete assistant history</Button>
        )}
      </div>
    </div>
  );
}
