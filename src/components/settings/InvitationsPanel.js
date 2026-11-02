"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, Send } from "lucide-react";
import { Button, Input, useToast } from "@/components/ui";
import { invitationService } from "@/services/api";
import { cn, formatShortDate } from "@/lib/utils";

const statusTone = {
  pending: "text-heading",
  accepted: "text-success",
  expired: "text-muted",
};

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      leftIcon={copied ? <Check /> : <Copy />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this invitation link", url);
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export default function InvitationsPanel() {
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await invitationService.list();
      setInvitations(data.invitations || []);
    } catch {
      // The form still works; the list simply stays empty.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSending(true);
    try {
      const data = await invitationService.create(email);
      setLatest({ email: data.invitation.email, url: data.inviteUrl, delivered: data.delivered });
      setEmail("");
      addToast({
        message: data.delivered ? `Invitation emailed to ${data.invitation.email}` : "Invitation created. Share the link below.",
        type: "success",
      });
      load();
    } catch (requestError) {
      setError(requestError.message || "The invitation couldn't be created.");
    } finally {
      setIsSending(false);
    }
  };

  const handleRevoke = async (invitation) => {
    try {
      await invitationService.revoke(invitation.id);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      if (latest?.email === invitation.email) setLatest(null);
      addToast({ message: `Invitation for ${invitation.email} revoked`, type: "success" });
    } catch (requestError) {
      addToast({ message: requestError.message, type: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            type="email"
            required
            aria-label="Email to invite"
            placeholder="teammate@lancehawks.com"
            leftIcon={<Mail />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={error}
          />
        </div>
        <Button type="submit" leftIcon={<Send />} isLoading={isSending}>
          Send invite
        </Button>
      </form>

      {latest && (
        <div className="animate-slide-down rounded-xl border border-border bg-surface-secondary p-4">
          <p className="text-sm text-heading">
            {latest.delivered ? "Emailed to " : "Ready for "}
            <span className="font-medium">{latest.email}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {latest.delivered
              ? "You can also share the link yourself."
              : "Email delivery isn't configured, so share this link directly."}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-2xs text-body">
              {latest.url}
            </code>
            <CopyLinkButton url={latest.url} />
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-overline">Sent by you</p>
        {isLoading ? (
          <div className="skeleton h-10" />
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted">No invitations yet.</p>
        ) : (
          <div className="card divide-y divide-border overflow-hidden">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-heading">{invitation.email}</span>
                <span className={cn("text-xs capitalize", statusTone[invitation.status])}>{invitation.status}</span>
                <span className="hidden w-20 text-right font-mono text-2xs text-muted sm:block">
                  {invitation.status === "accepted"
                    ? formatShortDate(invitation.acceptedAt)
                    : `until ${formatShortDate(invitation.expiresAt)}`}
                </span>
                {invitation.status === "pending" ? (
                  <Button type="button" variant="ghost" size="xs" onClick={() => handleRevoke(invitation)}>
                    Revoke
                  </Button>
                ) : (
                  <span className="w-[3.75rem]" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
