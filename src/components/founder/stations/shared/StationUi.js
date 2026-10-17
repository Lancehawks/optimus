"use client";

import { Pencil, Save, Trash2 } from "lucide-react";
import { cx } from "../../utils/cx";
import styles from "./station.module.css";

export function StationHeader({ index, label, title, copy, action }) {
  return (
    <header className={styles.stationHeader}>
      <div>
        <p><span>{index}</span>{label}</p>
        <h1>{title}</h1>
        <small>{copy}</small>
      </div>
      {action}
    </header>
  );
}

export function ActionButton({ children, ...props }) {
  return <button className={styles.actionButton} type="button" {...props}>{children}</button>;
}

export function EmptyState({ children }) {
  return <div className={styles.emptyState}><span aria-hidden="true" />{children}</div>;
}

/** @param {{ loading: boolean, error?: string, onRetry?: () => void }} props */
export function StatusMessage({ loading, error, onRetry }) {
  if (loading) return <p className={styles.statusMessage}>Synchronising this part of the room...</p>;
  if (error) return <div className={styles.errorMessage} role="alert">{error} {onRetry && <ActionButton onClick={onRetry}>Retry</ActionButton>}</div>;
  return null;
}

/** "No items yet" placeholder, shown only after a successful empty load. */
export function CollectionEmptyState({ collection, children }) {
  if (collection.loading || collection.error || collection.items.length) return null;
  return <EmptyState>{children}</EmptyState>;
}

/** @param {{ name: string, onEdit: () => void, onRemove: () => void, className?: string }} props */
export function RowActions({ name, onEdit, onRemove, className }) {
  return (
    <div className={cx(styles.rowActions, className)}>
      <button type="button" onClick={onEdit} aria-label={`Edit ${name}`}><Pencil aria-hidden="true" /></button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}><Trash2 aria-hidden="true" /></button>
    </div>
  );
}

export function SaveButton({ disabled, saving, children }) {
  return (
    <button className={styles.primaryButton} disabled={disabled || saving}>
      <Save aria-hidden="true" /> {saving ? "Saving..." : children}
    </button>
  );
}

export function Field({ label, children }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

export function FieldPair({ children }) {
  return <div className={styles.fieldPair}>{children}</div>;
}

export function StatusSelect({ options, ...props }) {
  return (
    <select {...props}>
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  );
}

export function FormNote({ children }) {
  return <p className={styles.formNote}>{children}</p>;
}
