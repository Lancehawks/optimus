"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./station.module.css";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)";

/**
 * Modal side panel. Portals to the lobby root so animated station ancestors
 * cannot clip it while it keeps the lobby theme; traps focus and closes on
 * Escape, restoring focus on close.
 */
export function EditorPanel({ title, subtitle, onClose, children }) {
  const [host, setHost] = useState(null);
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const titleId = useId();
  useEffect(() => { setHost(document.querySelector("main[data-founder-room]")); }, []);
  useEffect(() => {
    if (!host) return;
    const previousFocus = /** @type {HTMLElement | null} */ (document.activeElement);
    /** @type {HTMLElement | null} */ (panel.current?.querySelector("input, select, textarea") || panel.current?.querySelector("button"))?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        /** @type {HTMLElement[]} */
        const controls = [...panel.current.querySelectorAll(FOCUSABLE)];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <>
      <button className={styles.editorBackdrop} type="button" onClick={onClose} aria-label="Close editor" />
      <aside ref={panel} className={styles.editorPanel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div><p>{subtitle}</p><h2 id={titleId}>{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close editor"><X aria-hidden="true" /></button>
        </header>
        {children}
      </aside>
    </>, host
  );
}

/** EditorPanel wrapping a form with the shared editor layout. */
export function EditorForm({ title, subtitle, onClose, onSubmit, children }) {
  return (
    <EditorPanel title={title} subtitle={subtitle} onClose={onClose}>
      <form className={styles.editorForm} onSubmit={onSubmit}>{children}</form>
    </EditorPanel>
  );
}
