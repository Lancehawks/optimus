"use client";

import { useEffect } from "react";
import { ENTRY_DURATION_MS } from "../constants";
import { cx } from "../utils/cx";
import { firstNameOf } from "../utils/format";
import theme from "../styles/theme.module.css";
import styles from "./RoomEntry.module.css";

/** Brief threshold animation between unlocking and the room. */
export function RoomEntry({ userName, onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, ENTRY_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <main className={cx(theme.surface, styles.entry)} aria-label="Entering Founder Lobby">
      <div className={styles.entryThreshold} aria-hidden="true">
        <span />
        <span />
      </div>
      <div className={styles.entryCopy}>
        <p>Founder Lobby</p>
        <h1>Welcome, {firstNameOf(userName)}.</h1>
        <span>Entering the room</span>
      </div>
    </main>
  );
}
