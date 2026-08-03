"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleCheckBig, LockKeyhole } from "lucide-react";
import { authService, isUnauthorizedError } from "@/services/api";
import styles from "./accountDeletion.module.css";

const CONFIRMATION = "DELETE MY ACCOUNT";

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
    if (
      !window.confirm(
        "Permanently delete this Optimus account? This cannot be undone."
      )
    ) {
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
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              <CircleCheckBig />
            </span>
            Optimus
          </Link>
          <Link href="/login" className={styles.headerLink}>Sign in</Link>
        </header>

        <section className={styles.hero}>
          <span className={styles.eyebrow}><LockKeyhole /> Account control</span>
          <h1>Delete your Optimus account</h1>
          <p>
            You can permanently delete your account here. Reauthentication and
            an exact confirmation phrase protect against accidental deletion.
          </p>
        </section>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>What is deleted</h2>
            <ul>
              <li>Your profile, email, password hash, and password-reset records</li>
              <li>Every session, Google connection, and queued personal job</li>
              <li>Private tasks, notes, calendars, events, resource records, habits, and other private workspace data</li>
              <li>Projects you own when there is no other active project member</li>
            </ul>
          </section>

          <section className={styles.card}>
            <h2>What shared teams retain</h2>
            <ul>
              <li>Projects with another active member transfer to the longest-standing active member</li>
              <li>Project-linked work transfers to the project&apos;s current owner</li>
              <li>Shared activity remains for project continuity, with your actor identity removed</li>
              <li>Provider backups and logs follow the infrastructure provider&apos;s retention schedule</li>
            </ul>
          </section>
        </div>

        <section className={`${styles.card} ${styles.actionCard}`}>
          {isDeleted ? (
            <div className={styles.success} role="status">
              <CheckCircle2 />
              <div>
                <h2>Account deleted</h2>
                <p>Your Optimus account and active credentials have been removed.</p>
                <Link href="/">Return to Optimus</Link>
              </div>
            </div>
          ) : authState === "authenticated" ? (
            <>
              <div className={styles.warning}>
                <AlertTriangle aria-hidden="true" />
                <p>This action is permanent and cannot be undone.</p>
              </div>
              <form onSubmit={handleDelete} className={styles.form}>
                <label>
                  Current password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Type <strong>{CONFIRMATION}</strong>
                  <input
                    type="text"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </label>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button
                  type="submit"
                  disabled={
                    isDeleting
                    || !currentPassword
                    || confirmation !== CONFIRMATION
                  }
                >
                  {isDeleting ? "Deleting account…" : "Permanently delete account"}
                </button>
              </form>
            </>
          ) : (
            <div className={styles.signInState}>
              <h2>
                {authState === "checking"
                  ? "Checking your session…"
                  : "Sign in to delete your account"}
              </h2>
              <p>
                {authState === "unavailable"
                  ? "We could not verify your session just now. You can retry this page or sign in."
                  : "Use the account you want to delete, then return to this page."}
              </p>
              {authState !== "checking" && (
                <Link href="/login">Continue to sign in</Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
