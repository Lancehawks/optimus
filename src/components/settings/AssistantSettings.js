"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { assistantService } from "@/services/api";
import { formatDate } from "@/lib/utils";

// Members see whether they have the assistant; only admins change it, from
// the Admin page.
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
        <Badge variant={enabledAt ? "success" : "neutral"} dot>{enabledAt ? "On" : "Off"}</Badge>
        <p className="text-sm text-body">
          {enabledAt
            ? `Turned on ${info?.enabledBy ? `by ${info.enabledBy} ` : ""}on ${formatDate(enabledAt)}.`
            : "An admin can turn the assistant on for you."}
        </p>
        {info?.model && <span className="font-mono text-[0.6875rem] text-muted">{info.model}</span>}
      </div>

      {isAdmin && (
        <p className="text-sm text-muted">
          You&apos;re an admin. Turn the assistant on or off for anyone, yourself included, on the{" "}
          <Link href="/admin" className="font-medium text-heading underline underline-offset-4">Admin page</Link>.
        </p>
      )}

      <div className="space-y-2 text-sm leading-6 text-body">
        <p>
          When it&apos;s on, your questions and the workspace items the assistant looks up to answer them are sent to
          Anthropic to write each reply. That can include tasks, events, notes, projects and routines, including items in
          shared projects you can see, and your memory below.
        </p>
        <p className="text-muted">
          It can read your workspace but can&apos;t change it. Conversations are kept until you delete them, including
          after the assistant is turned off.
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
