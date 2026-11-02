"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import OptimusLogo from "@/components/brand/OptimusLogo";
import { firstNameOf } from "../utils/format";
import styles from "../styles/header.module.css";

export function RoomHeader({ userName, lockError, onLock, isLocking }) {
  return (
    <header className={styles.lobbyHeader}>
      <Link href="/dashboard" className={styles.lobbyBrand}>
        <OptimusLogo size={22} />
        <strong>Optimus</strong>
        <small>Founder Lobby</small>
      </Link>
      <div className={styles.lobbyControls}>
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
