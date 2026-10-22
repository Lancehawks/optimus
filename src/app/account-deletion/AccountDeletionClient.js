"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { authService, isUnauthorizedError } from "@/services/api";
import { OptimusWordmark } from "@/components/brand/OptimusLogo";
import { Button, Input } from "@/components/ui";

const CONFIRMATION = "DELETE MY ACCOUNT";

function PolicyList({ title, items }) {
  return (
    <section className="border-t border-border py-6">
      <h2 className="text-overline">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm text-body">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AccountDeletionClient() {
  const [authState, setAuthState] = useState("checking");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(() => {
    let active = true;
    authService.me()
      .then(() => {
        if (active) setAuthState("authenticated");
      })
      .catch((requestError) => {
        if (!active) return;
        setAuthState(isUnauthorizedError(requestError) ? "guest" : "unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async (event) => {
    event.preventDefault();
    setError("");
    if (confirmation !== CONFIRMATION) {
      setError(`Type ${CONFIRMATION} exactly to continue.`);
      return;
    }
    if (!window.confirm("Permanently delete this Optimus account? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await authService.deleteAccount({ currentPassword, confirmation });
      setCurrentPassword("");
      setConfirmation("");
      setIsDeleted(true);
      setAuthState("guest");
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) setAuthState("guest");
      setError(requestError.message || "Account deletion could not be completed.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-canvas px-5 py-6 sm:px-10">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <Link href="/" aria-label="Optimus sign in">
          <OptimusWordmark size={20} />
        </Link>
        {authState === "authenticated" ? (
          <Link href="/settings" className="text-xs text-muted hover:text-heading">Back to settings</Link>
        ) : (
          <Link href="/?redirect=/account-deletion" className="text-xs text-muted hover:text-heading">Sign in</Link>
        )}
      </header>

      <article className="mx-auto mt-14 max-w-2xl animate-slide-up rounded-2xl bg-surface px-6 py-10 shadow-sm ring-1 ring-border sm:px-12">
        <p className="text-overline">Account control</p>
        <h1 className="text-display mt-3">Delete your account</h1>
        <p className="mt-4 max-w-lg text-sm text-muted">
          You can permanently delete your Optimus account here. Your current password and an exact
          confirmation phrase protect against accidental deletion.
        </p>

        <div className="mt-10">
          <PolicyList
            title="What is deleted"
            items={[
              "Your profile, email, password hash, and password-reset records",
              "Every session, Google connection, and unused invitation you sent",
              "Private tasks, notes, calendars, events, resource records, routines, and other private workspace data",
              "Your assistant conversations",
              "Projects you own when there is no other active project member",
            ]}
          />
          <PolicyList
            title="What shared teams retain"
            items={[
              "Projects with another active member transfer to the longest-standing active member",
              "Project-linked work transfers to the project’s current owner",
              "Shared activity remains for project continuity, with your actor identity removed",
              "Assistant usage counts (tokens and estimated cost, never message content) remain without your identity",
              "Provider backups and logs follow the infrastructure provider’s retention schedule, and assistant requests already sent to Anthropic follow Anthropic’s API retention policy",
            ]}
          />
        </div>

        <section className="mt-2 border-t border-border pt-8">
          {isDeleted ? (
            <div className="flex gap-3" role="status">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <h2 className="text-h3">Account deleted</h2>
                <p className="mt-1 text-sm text-muted">Your Optimus account and active credentials have been removed.</p>
                <Link href="/" className="mt-4 inline-block text-sm font-medium text-heading underline underline-offset-4">
                  Return to Optimus
                </Link>
              </div>
            </div>
          ) : authState === "authenticated" ? (
            <>
              <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-danger/25 bg-danger-light px-3 py-2.5 text-sm text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                This action is permanent and cannot be undone.
              </div>
              <form onSubmit={handleDelete} className="max-w-sm space-y-4">
                <Input
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
                <Input
                  label={`Type ${CONFIRMATION} to confirm`}
                  type="text"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  required
                />
                {error && <p className="text-xs text-danger" role="alert">{error}</p>}
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={isDeleting}
                  disabled={isDeleting || !currentPassword || confirmation !== CONFIRMATION}
                >
                  {isDeleting ? "Deleting account" : "Permanently delete account"}
                </Button>
              </form>
            </>
          ) : (
            <div>
              <h2 className="text-h3">
                {authState === "checking" ? "Checking your session…" : "Sign in to delete your account"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {authState === "unavailable"
                  ? "We could not verify your session just now. You can retry this page or sign in."
                  : "Use the account you want to delete, then return to this page."}
              </p>
              {authState !== "checking" && (
                <Link
                  href="/?redirect=/account-deletion"
                  className="mt-4 inline-block text-sm font-medium text-heading underline underline-offset-4"
                >
                  Continue to sign in
                </Link>
              )}
            </div>
          )}
        </section>
      </article>
    </main>
  );
}
