"use client";

import { Plus } from "lucide-react";
import { EMPTY_TARGET, TARGET_STATUS_OPTIONS } from "../constants";
import { useCollectionEditor } from "../hooks/useCollectionEditor";
import { useFounderCollection } from "../hooks/useFounderCollection";
import { FOUNDER_ENDPOINTS } from "../services/founderApi";
import { formatDate, formatNumber, padIndex } from "../utils/format";
import { sortTargets } from "../utils/sort";
import { EditorForm } from "./shared/EditorPanel";
import { ActionButton, CollectionEmptyState, Field, FieldPair, RowActions, SaveButton, StationHeader, StatusMessage, StatusSelect } from "./shared/StationUi";
import station from "./shared/station.module.css";
import styles from "./TargetsStation.module.css";

const canSaveTarget = (draft) => Boolean(draft.title.trim()) && Number(draft.targetValue) > 0;

function targetProgress(item) {
  return Math.max(0, Math.min(100, (item.currentValue / item.targetValue) * 100));
}

export function TargetsStation() {
  const collection = useFounderCollection(FOUNDER_ENDPOINTS.targets, "targets", "target", sortTargets);
  const editor = useCollectionEditor(collection, canSaveTarget);
  const { draft, field } = editor;

  return (
    <section className={station.stationViewport}>
      <StationHeader
        index="04"
        label="Targets"
        title="Make ambition measurable."
        copy="A quiet view of the outcomes the company is moving toward."
        action={<ActionButton onClick={() => editor.setDraft({ ...EMPTY_TARGET })}><Plus aria-hidden="true" /> Add target</ActionButton>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      <CollectionEmptyState collection={collection}>No targets yet. Define the first measurable outcome.</CollectionEmptyState>
      <div className={styles.targetLedger}>
        {collection.items.map((item, index) => (
          <article className={styles.targetRow} key={item.id}>
            <span className={station.itemIndex}>{padIndex(index)}</span>
            <div className={station.itemCopy}><small>{item.status}</small><h2>{item.title}</h2><p>{item.deadline ? `By ${formatDate(item.deadline)}` : "Open deadline"}</p></div>
            <div className={styles.targetProgress}>
              <div className={station.progressTrack}><span style={{ width: `${targetProgress(item)}%` }} /></div>
              <p><strong>{formatNumber(item.currentValue)}</strong> / {formatNumber(item.targetValue)} {item.unit}</p>
            </div>
            <RowActions
              className={styles.targetActions}
              name={item.title}
              onEdit={() => editor.setDraft({ ...item })}
              onRemove={() => editor.remove(item, `Remove the target “${item.title}”?`)}
            />
          </article>
        ))}
      </div>
      {draft && (
        <EditorForm title={draft.id ? "Edit target" : "New target"} subtitle="Outcome control" onClose={() => editor.setDraft(null)} onSubmit={editor.submit}>
          <Field label="Target"><input autoFocus maxLength={160} {...field("title")} /></Field>
          <FieldPair>
            <Field label="Current"><input type="number" step="any" {...field("currentValue")} /></Field>
            <Field label="Goal"><input type="number" min="0.01" step="any" {...field("targetValue")} /></Field>
          </FieldPair>
          <FieldPair>
            <Field label="Unit"><input maxLength={24} placeholder="users, %, INR" {...field("unit")} /></Field>
            <Field label="Deadline"><input type="date" {...field("deadline")} /></Field>
          </FieldPair>
          <Field label="Status"><StatusSelect options={TARGET_STATUS_OPTIONS} {...field("status")} /></Field>
          <SaveButton disabled={!editor.canSave} saving={editor.saving}>Save target</SaveButton>
        </EditorForm>
      )}
    </section>
  );
}
