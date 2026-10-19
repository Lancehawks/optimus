"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { DEFAULT_COUNTDOWN } from "../constants";
import { FOUNDER_ENDPOINTS, requestFounderJson } from "../services/founderApi";
import { toDateTimeInput } from "../utils/time";
import styles from "./CountdownSettings.module.css";

/** Drawer for setting the shared countdown, with its click-to-close backdrop. */
export function CountdownSettings({ countdown, onClose, onSaved }) {
  const [title, setTitle] = useState(countdown.title || DEFAULT_COUNTDOWN.title);
  const [targetAt, setTargetAt] = useState(toDateTimeInput(countdown.targetAt));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSave = Boolean(title.trim() && targetAt) && !isSaving;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    setError("");

    try {
      const result = await requestFounderJson(FOUNDER_ENDPOINTS.countdown, {
        method: "PUT",
        body: { title: title.trim(), targetAt: new Date(targetAt).toISOString() },
        fallbackError: "The countdown could not be saved.",
      });
      onSaved(result.countdown);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.settingsBackdrop}
        aria-label="Close timer settings"
        onClick={onClose}
      />
      <aside className={styles.settings} aria-labelledby="countdown-settings-title">
        <header>
          <div>
            <p>Room control</p>
            <h2 id="countdown-settings-title">Set the countdown</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close timer settings">
            <X aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <label htmlFor="countdown-title">
            Milestone name
            <input
              id="countdown-title"
              type="text"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Main milestone"
            />
          </label>

          <label htmlFor="countdown-target">
            Target date and time
            <input
              id="countdown-target"
              type="datetime-local"
              min={toDateTimeInput(new Date())}
              value={targetAt}
              onChange={(event) => setTargetAt(event.target.value)}
            />
          </label>

          <p className={styles.settingsNote}>
            This timer is shared with everyone who enters the Founder Lobby.
          </p>
          <p className={styles.settingsError} role="alert">{error}</p>

          <button className={styles.saveButton} type="submit" disabled={!canSave}>
            <Check aria-hidden="true" />
            {isSaving ? "Saving..." : "Set countdown"}
          </button>
        </form>
      </aside>
    </>
  );
}
