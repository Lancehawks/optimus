"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import OptimusLogo from "@/components/brand/OptimusLogo";
import { FOUNDER_THEMES } from "@/lib/founderValues";
import { capitalize, firstNameOf } from "../utils/format";
import styles from "../styles/header.module.css";

export function RoomHeader({ userName, theme, themeNotice, onThemeChange, lockError, onLock, isLocking }) {
  return (
    <header className={styles.lobbyHeader}>
      <Link href="/dashboard" className={styles.lobbyBrand}>
        <OptimusLogo size={34} />
        <strong>Optimus</strong>
        <small>Founder Lobby</small>
      </Link>
      <div className={styles.lobbyControls}>
        <label className={styles.themePicker}>
          <span>Theme</span>
          <select aria-label="Founder Lobby theme" value={theme} onChange={(event) => onThemeChange(event.target.value)}>
            {FOUNDER_THEMES.map((value) => <option key={value} value={value}>{capitalize(value)}</option>)}
          </select>
        </label>
        {themeNotice && <span role="status">{themeNotice}</span>}
        {lockError && <span role="alert">{lockError}</span>}
        <span className={styles.roomStatus}>
          <i aria-hidden="true" /> Welcome, {firstNameOf(userName)}
        </span>
        <Link href="/dashboard" aria-label="Return to Optimus">
          <ArrowLeft aria-hidden="true" /><span>Optimus</span>
        </Link>
        <button type="button" onClick={onLock} disabled={isLocking} aria-label="Lock Founder Lobby">
          <Lock aria-hidden="true" /><span>{isLocking ? "Locking..." : "Lock"}</span>
        </button>
      </div>
    </header>
  );
}
