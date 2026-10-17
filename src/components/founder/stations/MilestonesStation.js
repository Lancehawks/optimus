"use client";

import { Plus } from "lucide-react";
import { EMPTY_MILESTONE, MILESTONE_STATUS_OPTIONS } from "../constants";
import { useCollectionEditor } from "../hooks/useCollectionEditor";
import { useFounderCollection } from "../hooks/useFounderCollection";
import { FOUNDER_ENDPOINTS } from "../services/founderApi";
import { cx } from "../utils/cx";
import { formatDate, padIndex } from "../utils/format";
import { sortMilestones } from "../utils/sort";
import { EditorForm } from "./shared/EditorPanel";
import { ActionButton, CollectionEmptyState, Field, RowActions, SaveButton, StationHeader, StatusMessage, StatusSelect } from "./shared/StationUi";
import station from "./shared/station.module.css";
import styles from "./MilestonesStation.module.css";

const canSaveMilestone = (draft) => Boolean(draft.title.trim() && draft.milestoneOn);

export function MilestonesStation() {
  const collection = useFounderCollection(FOUNDER_ENDPOINTS.milestones, "milestones", "milestone", sortMilestones);
  const editor = useCollectionEditor(collection, canSaveMilestone);
  const { draft, field } = editor;

  return (
    <section className={station.stationViewport}>
      <StationHeader
        index="03"
        label="Company milestones"
        title="The company, in moments."
        copy="Record what changed the trajectory and what must happen next."
        action={<ActionButton onClick={() => editor.setDraft({ ...EMPTY_MILESTONE })}><Plus aria-hidden="true" /> Add milestone</ActionButton>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      <CollectionEmptyState collection={collection}>No milestones yet. Place the first marker on the timeline.</CollectionEmptyState>
      <div className={styles.timeline}>
        {collection.items.map((item, index) => (
          <article className={styles.timelineItem} key={item.id}>
            <div className={styles.timelineDate}><span className={station.itemIndex}>{padIndex(index)}</span>{formatDate(item.milestoneOn)}</div>
            <i data-status={item.status} aria-hidden="true" />
            <div className={cx(styles.timelineCopy, station.itemCopy)}>
              <small>{item.status}</small>
              <h2>{item.title}</h2>
              {item.details && <p>{item.details}</p>}
            </div>
            <RowActions
              className={styles.timelineActions}
              name={item.title}
              onEdit={() => editor.setDraft({ ...item })}
              onRemove={() => editor.remove(item, `Remove “${item.title}” from the company timeline?`)}
            />
          </article>
        ))}
      </div>
      {draft && (
        <EditorForm title={draft.id ? "Edit milestone" : "New milestone"} subtitle="Company timeline" onClose={() => editor.setDraft(null)} onSubmit={editor.submit}>
          <Field label="Milestone"><input autoFocus maxLength={160} {...field("title")} /></Field>
          <Field label="Date"><input type="date" {...field("milestoneOn")} /></Field>
          <Field label="Status"><StatusSelect options={MILESTONE_STATUS_OPTIONS} {...field("status")} /></Field>
          <Field label="Context"><textarea rows={5} maxLength={2000} {...field("details")} /></Field>
          <SaveButton disabled={!editor.canSave} saving={editor.saving}>Save milestone</SaveButton>
        </EditorForm>
      )}
    </section>
  );
}
