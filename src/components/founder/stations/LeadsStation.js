"use client";

import { Download, Plus } from "lucide-react";
import { formatFounderMoney as formatMoney } from "@/lib/founderValues";
import { EMPTY_LEAD, LEAD_STAGES } from "../constants";
import { useCollectionEditor } from "../hooks/useCollectionEditor";
import { useFounderCollection } from "../hooks/useFounderCollection";
import { FOUNDER_ENDPOINTS } from "../services/founderApi";
import { cx } from "../utils/cx";
import { capitalize, formatDate, padIndex } from "../utils/format";
import { downloadLeadsCsv } from "../utils/leadsCsv";
import { sortLeads } from "../utils/sort";
import { EditorForm } from "./shared/EditorPanel";
import { ActionButton, CollectionEmptyState, Field, FieldPair, RowActions, SaveButton, StationHeader, StatusMessage } from "./shared/StationUi";
import station from "./shared/station.module.css";
import styles from "./LeadsStation.module.css";

const canSaveLead = (draft) => Boolean(draft.clientName.trim());

export function LeadsStation() {
  const collection = useFounderCollection(FOUNDER_ENDPOINTS.leads, "leads", "lead", sortLeads);
  const editor = useCollectionEditor(collection, canSaveLead);
  const { draft, field } = editor;

  const headerActions = (
    <div className={station.headerActions}>
      <ActionButton onClick={() => downloadLeadsCsv(collection.items)} disabled={!collection.items.length}><Download aria-hidden="true" /> Export CSV</ActionButton>
      <ActionButton onClick={() => editor.setDraft({ ...EMPTY_LEAD })}><Plus aria-hidden="true" /> Add lead</ActionButton>
    </div>
  );

  return (
    <section className={cx(station.stationViewport, styles.leadsViewport)}>
      <StationHeader
        index="06"
        label="Client leads"
        title="The relationship ledger."
        copy="A shared, editable sheet for every live commercial conversation."
        action={headerActions}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      <CollectionEmptyState collection={collection}>No leads in the ledger yet. Add the first conversation.</CollectionEmptyState>
      {collection.items.length > 0 && (
        <div className={styles.sheetWrap}>
          <table className={styles.leadSheet}>
            <thead><tr><th>#</th><th>Client</th><th>Company</th><th>Stage</th><th>Value (INR)</th><th>Follow up</th><th>Owner</th><th><span className={station.srOnly}>Actions</span></th></tr></thead>
            <tbody>
              {collection.items.map((lead, index) => (
                <tr key={lead.id}>
                  <td>{padIndex(index)}</td>
                  <td><strong>{lead.clientName}</strong><small>{lead.email || "No email"}</small></td>
                  <td>{lead.company || "—"}</td>
                  <td><span className={styles.stage} data-stage={lead.stage}>{lead.stage}</span></td>
                  <td>{formatMoney(lead.value)}</td>
                  <td>{lead.followUpOn ? formatDate(lead.followUpOn) : "—"}</td>
                  <td>{lead.owner || "—"}</td>
                  <td>
                    <RowActions
                      name={lead.clientName}
                      onEdit={() => editor.setDraft({ ...lead })}
                      onRemove={() => editor.remove(lead, `Remove ${lead.clientName} from the lead sheet?`)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {draft && (
        <EditorForm title={draft.id ? "Update lead" : "New lead"} subtitle="Client ledger" onClose={() => editor.setDraft(null)} onSubmit={editor.submit}>
          <Field label="Client or contact"><input autoFocus maxLength={160} {...field("clientName")} /></Field>
          <Field label="Company"><input maxLength={160} {...field("company")} /></Field>
          <Field label="Email"><input type="email" maxLength={255} {...field("email")} /></Field>
          <FieldPair>
            <Field label="Stage"><select {...field("stage")}>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{capitalize(stage)}</option>)}</select></Field>
            <Field label="Value (INR)"><input type="number" min="0" step="0.01" {...field("value")} /></Field>
          </FieldPair>
          <FieldPair>
            <Field label="Follow up"><input type="date" {...field("followUpOn")} /></Field>
            <Field label="Owner"><input maxLength={120} {...field("owner")} /></Field>
          </FieldPair>
          <Field label="Notes"><textarea rows={5} maxLength={4000} {...field("notes")} /></Field>
          <SaveButton disabled={!editor.canSave} saving={editor.saving}>Save lead</SaveButton>
        </EditorForm>
      )}
    </section>
  );
}
