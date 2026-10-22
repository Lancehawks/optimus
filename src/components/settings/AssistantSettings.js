"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { assistantService } from "@/services/api";
import { formatDate } from "@/lib/utils";

// Members see whether they may use the workspace AI key; only admins change
// that, from the Admin page. Their own keys live in the API keys section.
export default function AssistantSettings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [info, setInfo] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const enabledAt = info?.enabledAt ?? user?.ai_assistant_enabled_at ?? null;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let cancelled = false;
    assistantService.getSettings()
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, []);

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
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={enabledAt ? "success" : "neutral"} dot>{enabledAt ? "Workspace key on" : "Workspace key off"}</Badge>
        <p className="text-sm text-body">
          {enabledAt
            ? `You can use the workspace AI key${info?.model ? ` (${info.model})` : ""}. Turned on ${info?.enabledBy ? `by ${info.enabledBy} ` : ""}on ${formatDate(enabledAt)}.`
            : "An admin can let you use the workspace AI key. You can also add your own key below."}
        </p>
      </div>

      {isAdmin && (
        <p className="text-sm text-muted">
          You&apos;re an admin. Decide who can use the workspace key, yourself included, and which models members can
          pick, on the <Link href="/admin" className="font-medium text-heading underline underline-offset-4">Admin page</Link>.
        </p>
      )}

      <div className="space-y-2 text-sm leading-6 text-body">
        <p>
          When you ask something, your question and the workspace items the assistant looks up are sent to the
          model&apos;s provider: Anthropic for the workspace key, or the provider of your own key. That can include tasks,
          events, notes, projects and routines, including items in shared projects you can see, and your memory.
        </p>
        <p className="text-muted">
          It can read your workspace but can&apos;t change it. Conversations are kept until you delete them.
        </p>
      </div>

      {info && !info.available && (
        <p className="rounded-lg bg-warning-light px-3 py-2 text-xs text-body">
          The workspace AI key isn&apos;t set up on this server yet. You can still use the assistant with your own key.
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
