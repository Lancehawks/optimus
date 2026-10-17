"use client";

import { useEffect, useMemo, useState, useRef, useId } from "react";
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Check,
  Download,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import styles from "./FounderStations.module.css";

import { formatFounderMoney as formatMoney, founderCsvCell as csvCell } from "@/lib/founderValues";

const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

async function requestJson(url, options) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The room could not be updated.");
  if (options?.method && options.method !== "GET") window.dispatchEvent(new CustomEvent("founder:data-changed", {detail: url.split("?")[0]}));
  return result;
}

function formatDate(value, options = { dateStyle: "medium" }) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${value}T00:00:00`));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}


function getBuildingDay(startedOn) {
  if (!startedOn) return null;
  const start = Date.parse(`${startedOn}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - start) / 86_400_000) + 1;
}

function StationHeader({ index, label, title, copy, action }) {
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

function ActionButton({ children, ...props }) {
  return <button className={styles.actionButton} type="button" {...props}>{children}</button>;
}

function EmptyState({ children }) {
  return <div className={styles.emptyState}><span aria-hidden="true" />{children}</div>;
}

function StatusMessage({ loading, error, onRetry }) {
  if (loading) return <p className={styles.statusMessage}>Synchronising this part of the room...</p>;
  if (error) return <div className={styles.errorMessage} role="alert">{error} {onRetry && <ActionButton onClick={onRetry}>Retry</ActionButton>}</div>;
  return null;
}

function EditorPanel({ title, subtitle, onClose, children }) {
  const [host, setHost] = useState(null);
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const titleId = useId();
  useEffect(() => { setHost(document.querySelector('main[data-founder-theme]')); }, []);
  useEffect(() => {
    if (!host) return;
    const previousFocus = document.activeElement;
    (panel.current?.querySelector('input, select, textarea') || panel.current?.querySelector('button'))?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === 'Tab') {
        const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); previousFocus?.focus(); };
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

function Field({ label, children }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

function useFounderCollection(endpoint, key, itemKey) {
  const [reload, setReload] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    requestJson(endpoint)
      .then((result) => {
        if (!active) return;
        setItems(result[key] || []);
        setError("");
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [endpoint, key, reload]);

  const save = async (item) => {
    setError("");
    const isExisting = Boolean(item.id);
    const result = await requestJson(endpoint, {
      method: isExisting ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const saved = result[itemKey];
    setItems((current) => isExisting
      ? current.map((entry) => entry.id === saved.id ? saved : entry)
      : [...current, saved]);
    return saved;
  };

  const remove = async (id) => {
    setError("");
    const version = items.find(item => item.id === id)?.version;
    await requestJson(`${endpoint}?id=${encodeURIComponent(id)}&version=${encodeURIComponent(version || "")}`, { method: "DELETE" });
    setItems((current) => current.filter((entry) => entry.id !== id));
  };

  return { retry: () => setReload(value => value + 1), items, setItems, loading, error, setError, save, remove };
}

export function BuildingDayStation() {
  const [settings, setSettings] = useState(null);
  const [startedOn, setStartedOn] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    requestJson("/api/founder/settings")
      .then((result) => {
        if (!active) return;
        setSettings(result.settings);
        setStartedOn(result.settings.companyStartedOn || "");
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const buildingDay = getBuildingDay(settings?.companyStartedOn);

  const saveStartDate = async (event) => {
    event.preventDefault();
    if (!startedOn || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await requestJson("/api/founder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyStartedOn: startedOn }),
      });
      setSettings(result.settings);
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.stationViewport}>
      <StationHeader
        index="02"
        label="Building day"
        title="The work has a beginning."
        copy="One continuous count from the day the company began."
        action={<ActionButton onClick={() => setEditing(true)}><Pencil aria-hidden="true" /> Set origin</ActionButton>}
      />
      <StatusMessage loading={loading} error={error} />
      {!loading && (
        <div className={styles.buildingMonument}>
          <p>Day</p>
          <strong>{buildingDay === null ? "---" : Math.max(0, buildingDay)}</strong>
          <div>
            <span>{buildingDay !== null && buildingDay < 1 ? "Until building begins" : "Of building"}</span>
            <small>{settings?.companyStartedOn ? `Since ${formatDate(settings.companyStartedOn, { dateStyle: "long" })}` : "Choose the first day to begin the count"}</small>
          </div>
        </div>
      )}
      {editing && (
        <EditorPanel title="Set the first day" subtitle="Building origin" onClose={() => setEditing(false)}>
          <form className={styles.editorForm} onSubmit={saveStartDate}>
            <Field label="Company started on">
              <input type="date" value={startedOn} onChange={(event) => setStartedOn(event.target.value)} />
            </Field>
            <p className={styles.formNote}>This becomes the shared Day 1 for everyone in the room.</p>
            <button className={styles.primaryButton} disabled={!startedOn || saving}>
              <Save aria-hidden="true" /> {saving ? "Saving..." : "Save origin"}
            </button>
          </form>
        </EditorPanel>
      )}
    </section>
  );
}

const EMPTY_MILESTONE = { title: "", details: "", milestoneOn: "", status: "planned" };

export function MilestonesStation() {
  const collection = useFounderCollection("/api/founder/milestones", "milestones", "milestone");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveMilestone = async (event) => {
    event.preventDefault();
    if (!draft?.title || !draft?.milestoneOn || saving) return;
    setSaving(true);
    try {
      await collection.save(draft);
      setDraft(null);
    } catch (error) {
      collection.setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeMilestone = async (item) => {
    if (!window.confirm(`Remove “${item.title}” from the company timeline?`)) return;
    try { await collection.remove(item.id); } catch (error) { collection.setError(error.message); }
  };

  return (
    <section className={styles.stationViewport}>
      <StationHeader
        index="03"
        label="Company milestones"
        title="The company, in moments."
        copy="Record what changed the trajectory and what must happen next."
        action={<ActionButton onClick={() => setDraft({ ...EMPTY_MILESTONE })}><Plus aria-hidden="true" /> Add milestone</ActionButton>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      {!collection.loading && !collection.error && collection.items.length === 0 && <EmptyState>No milestones yet. Place the first marker on the timeline.</EmptyState>}
      <div className={styles.timeline}>
        {collection.items.map((item, index) => (
          <article className={styles.timelineItem} key={item.id}>
            <div className={styles.timelineDate}><span>{String(index + 1).padStart(2, "0")}</span>{formatDate(item.milestoneOn)}</div>
            <i data-status={item.status} aria-hidden="true" />
            <div className={styles.timelineCopy}>
              <small>{item.status}</small>
              <h2>{item.title}</h2>
              {item.details && <p>{item.details}</p>}
            </div>
            <div className={styles.rowActions}>
              <button onClick={() => setDraft({ ...item })} aria-label={`Edit ${item.title}`}><Pencil aria-hidden="true" /></button>
              <button onClick={() => removeMilestone(item)} aria-label={`Remove ${item.title}`}><Trash2 aria-hidden="true" /></button>
            </div>
          </article>
        ))}
      </div>
      {draft && (
        <EditorPanel title={draft.id ? "Edit milestone" : "New milestone"} subtitle="Company timeline" onClose={() => setDraft(null)}>
          <form className={styles.editorForm} onSubmit={saveMilestone}>
            <Field label="Milestone"><input autoFocus maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
            <Field label="Date"><input type="date" value={draft.milestoneOn || ""} onChange={(event) => setDraft({ ...draft, milestoneOn: event.target.value })} /></Field>
            <Field label="Status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="planned">Planned</option><option value="active">In progress</option><option value="achieved">Achieved</option></select></Field>
            <Field label="Context"><textarea rows={5} maxLength={2000} value={draft.details || ""} onChange={(event) => setDraft({ ...draft, details: event.target.value })} /></Field>
            <button className={styles.primaryButton} disabled={!draft.title.trim() || !draft.milestoneOn || saving}><Save aria-hidden="true" /> {saving ? "Saving..." : "Save milestone"}</button>
          </form>
        </EditorPanel>
      )}
    </section>
  );
}

const EMPTY_TARGET = { title: "", currentValue: 0, targetValue: "", unit: "", deadline: "", status: "active" };

export function TargetsStation() {
  const collection = useFounderCollection("/api/founder/targets", "targets", "target");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveTarget = async (event) => {
    event.preventDefault();
    if (!draft?.title || Number(draft.targetValue) <= 0 || saving) return;
    setSaving(true);
    try {
      await collection.save(draft);
      setDraft(null);
    } catch (error) {
      collection.setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeTarget = async (item) => {
    if (!window.confirm(`Remove the target “${item.title}”?`)) return;
    try { await collection.remove(item.id); } catch (error) { collection.setError(error.message); }
  };

  return (
    <section className={styles.stationViewport}>
      <StationHeader
        index="04"
        label="Targets"
        title="Make ambition measurable."
        copy="A quiet view of the outcomes the company is moving toward."
        action={<ActionButton onClick={() => setDraft({ ...EMPTY_TARGET })}><Plus aria-hidden="true" /> Add target</ActionButton>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      {!collection.loading && !collection.error && collection.items.length === 0 && <EmptyState>No targets yet. Define the first measurable outcome.</EmptyState>}
      <div className={styles.targetLedger}>
        {collection.items.map((item, index) => {
          const progress = Math.max(0, Math.min(100, (item.currentValue / item.targetValue) * 100));
          return (
            <article className={styles.targetRow} key={item.id}>
              <span className={styles.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
              <div className={styles.targetIdentity}><small>{item.status}</small><h2>{item.title}</h2><p>{item.deadline ? `By ${formatDate(item.deadline)}` : "Open deadline"}</p></div>
              <div className={styles.targetProgress}>
                <div><span style={{ width: `${progress}%` }} /></div>
                <p><strong>{formatNumber(item.currentValue)}</strong> / {formatNumber(item.targetValue)} {item.unit}</p>
              </div>
              <div className={styles.rowActions}>
                <button onClick={() => setDraft({ ...item })} aria-label={`Edit ${item.title}`}><Pencil aria-hidden="true" /></button>
                <button onClick={() => removeTarget(item)} aria-label={`Remove ${item.title}`}><Trash2 aria-hidden="true" /></button>
              </div>
            </article>
          );
        })}
      </div>
      {draft && (
        <EditorPanel title={draft.id ? "Edit target" : "New target"} subtitle="Outcome control" onClose={() => setDraft(null)}>
          <form className={styles.editorForm} onSubmit={saveTarget}>
            <Field label="Target"><input autoFocus maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
            <div className={styles.fieldPair}>
              <Field label="Current"><input type="number" step="any" value={draft.currentValue} onChange={(event) => setDraft({ ...draft, currentValue: event.target.value })} /></Field>
              <Field label="Goal"><input type="number" min="0.01" step="any" value={draft.targetValue} onChange={(event) => setDraft({ ...draft, targetValue: event.target.value })} /></Field>
            </div>
            <div className={styles.fieldPair}>
              <Field label="Unit"><input maxLength={24} placeholder="users, %, INR" value={draft.unit || ""} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></Field>
              <Field label="Deadline"><input type="date" value={draft.deadline || ""} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></Field>
            </div>
            <Field label="Status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="active">Active</option><option value="paused">Paused</option><option value="achieved">Achieved</option></select></Field>
            <button className={styles.primaryButton} disabled={!draft.title.trim() || Number(draft.targetValue) <= 0 || saving}><Save aria-hidden="true" /> {saving ? "Saving..." : "Save target"}</button>
          </form>
        </EditorPanel>
      )}
    </section>
  );
}

export function SalesStation() {
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState(null);
  const [target, setTarget] = useState(0);

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const [leadResult, settingResult] = await Promise.all([requestJson("/api/founder/leads"), requestJson("/api/founder/settings")]);
        if (!active || request !== generation) return;
        setLeads(leadResult.leads || []);
        setSettings(settingResult.settings);
        setTarget(settingResult.settings.salesTarget || 0);
        setError("");
      } catch (loadError) {
        if (active && request === generation) setError(loadError.message);
      } finally {
        if (active && request === generation) setLoading(false);
      }
    };
    const changed = event => { if (event.detail === '/api/founder/leads') load(); };
    load();
    window.addEventListener('founder:data-changed', changed);
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('founder:data-changed', changed); window.removeEventListener('focus', load); };
  }, []);

  const metrics = useMemo(() => {
    const won = leads.filter((lead) => lead.stage === "won");
    const closed = leads.filter((lead) => lead.stage === "won" || lead.stage === "lost");
    const open = leads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");
    const byStage = LEAD_STAGES
      .filter((stage) => stage !== "lost")
      .map((stage) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage);
        return {
          stage,
          count: stageLeads.length,
          value: stageLeads.reduce((sum, lead) => sum + Number(lead.value || 0), 0),
        };
      });
    return {
      wonValue: won.reduce((sum, lead) => sum + Number(lead.value || 0), 0),
      pipelineValue: open.reduce((sum, lead) => sum + Number(lead.value || 0), 0),
      openCount: open.length,
      conversion: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
      byStage,
      largestStage: Math.max(1, ...byStage.map((stage) => stage.count)),
    };
  }, [leads]);

  const progress = settings?.salesTarget > 0
    ? Math.min(100, (metrics.wonValue / settings.salesTarget) * 100)
    : 0;

  const saveSalesTarget = async (event) => {
    event.preventDefault();
    if (!Number.isFinite(Number(target)) || Number(target) < 0 || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await requestJson("/api/founder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesTarget: Number(target), salesCurrency: "INR" }),
      });
      setSettings(result.settings);
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.stationViewport}>
      <StationHeader
        index="05"
        label="Sales"
        title="Commercial overview"
        copy="Revenue, pipeline health, and lead movement in one clear view."
        action={<ActionButton onClick={() => setEditing(true)}><Pencil aria-hidden="true" /> Sales target</ActionButton>}
      />
      <StatusMessage loading={loading} error={error} />
      {!loading && !error && (
        <div className={styles.salesConsole}>
          <div className={styles.salesSummary}>
            <div className={styles.salesPrimary}>
              <div className={styles.metricHeading}>
                <span>Closed value</span>
                <small>Won revenue</small>
              </div>
              <strong>{formatMoney(metrics.wonValue, settings?.salesCurrency)}</strong>
              <div className={styles.salesTrack} aria-label={`${Math.round(progress)}% of sales target`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.targetCaption}>
                <span>{settings?.salesTarget > 0 ? `${Math.round(progress)}% achieved` : "No target set"}</span>
                <span>{settings?.salesTarget > 0 ? `Target ${formatMoney(settings.salesTarget, settings.salesCurrency)}` : "Add a target to track progress"}</span>
              </div>
            </div>
            <div className={styles.salesReadings}>
              <div><span>Pipeline value</span><strong>{formatMoney(metrics.pipelineValue, settings?.salesCurrency)}</strong><small>Across active leads</small></div>
              <div><span>Open leads</span><strong>{String(metrics.openCount).padStart(2, "0")}</strong><small>Still in motion</small></div>
              <div><span>Win rate</span><strong>{metrics.conversion}%</strong><small>Of closed leads</small></div>
            </div>
          </div>
          <section className={styles.pipelineBoard} aria-labelledby="pipeline-heading">
            <header>
              <div><span>Pipeline distribution</span><h2 id="pipeline-heading">Lead movement by stage</h2></div>
              <small>{leads.length} total {leads.length === 1 ? "lead" : "leads"}</small>
            </header>
            <div className={styles.pipelineStages}>
              {metrics.byStage.map((stage) => (
                <div className={styles.pipelineStage} key={stage.stage}>
                  <div>
                    <span>{stage.stage}</span>
                    <small>{formatMoney(stage.value, settings?.salesCurrency)}</small>
                  </div>
                  <div className={styles.pipelineTrack}>
                    <span style={{ width: `${(stage.count / metrics.largestStage) * 100}%` }} />
                  </div>
                  <strong>{stage.count}</strong>
                </div>
              ))}
            </div>
          </section>
          <div className={styles.salesSource}>
            <ArrowUpRight aria-hidden="true" />
            <span>Lead stages and values update this view automatically.</span>
          </div>
        </div>
      )}
      {editing && (
        <EditorPanel title="Set the sales target" subtitle="Commercial control" onClose={() => setEditing(false)}>
          <form className={styles.editorForm} onSubmit={saveSalesTarget}>
            <Field label="Target value"><input type="number" min="0" step="any" value={target} onChange={(event) => setTarget(event.target.value)} /></Field>
            <p className={styles.formNote}>All commercial values are in Indian rupees (INR).</p>
            <p className={styles.formNote}>Closed value is calculated from leads marked Won.</p>
            <button className={styles.primaryButton} disabled={!Number.isFinite(Number(target)) || Number(target) < 0 || saving}><Save aria-hidden="true" /> {saving ? "Saving..." : "Save sales target"}</button>
          </form>
        </EditorPanel>
      )}
    </section>
  );
}

const EMPTY_LEAD = { clientName: "", company: "", email: "", owner: "", stage: "new", value: 0, followUpOn: "", notes: "" };


export function LeadsStation() {
  const collection = useFounderCollection("/api/founder/leads", "leads", "lead");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveLead = async (event) => {
    event.preventDefault();
    if (!draft?.clientName || saving) return;
    setSaving(true);
    try {
      await collection.save(draft);
      setDraft(null);
    } catch (error) {
      collection.setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeLead = async (item) => {
    if (!window.confirm(`Remove ${item.clientName} from the lead sheet?`)) return;
    try { await collection.remove(item.id); } catch (error) { collection.setError(error.message); }
  };

  const exportCsv = () => {
    const headers = ["Client", "Company", "Email", "Owner", "Stage", "Value (INR)", "Follow up", "Notes"];
    const rows = collection.items.map((lead) => [lead.clientName, lead.company, lead.email, lead.owner, lead.stage, lead.value, lead.followUpOn, lead.notes]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `founder-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className={`${styles.stationViewport} ${styles.leadsViewport}`}>
      <StationHeader
        index="06"
        label="Client leads"
        title="The relationship ledger."
        copy="A shared, editable sheet for every live commercial conversation."
        action={<div className={styles.headerActions}><ActionButton onClick={exportCsv} disabled={!collection.items.length}><Download aria-hidden="true" /> Export CSV</ActionButton><ActionButton onClick={() => setDraft({ ...EMPTY_LEAD })}><Plus aria-hidden="true" /> Add lead</ActionButton></div>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      {!collection.loading && !collection.error && collection.items.length === 0 && <EmptyState>No leads in the ledger yet. Add the first conversation.</EmptyState>}
      {collection.items.length > 0 && (
        <div className={styles.sheetWrap}>
          <table className={styles.leadSheet}>
            <thead><tr><th>#</th><th>Client</th><th>Company</th><th>Stage</th><th>Value (INR)</th><th>Follow up</th><th>Owner</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
            <tbody>
              {collection.items.map((lead, index) => (
                <tr key={lead.id}>
                  <td>{String(index + 1).padStart(2, "0")}</td>
                  <td><strong>{lead.clientName}</strong><small>{lead.email || "No email"}</small></td>
                  <td>{lead.company || "—"}</td>
                  <td><span className={styles.stage} data-stage={lead.stage}>{lead.stage}</span></td>
                  <td>{formatMoney(lead.value)}</td>
                  <td>{lead.followUpOn ? formatDate(lead.followUpOn) : "—"}</td>
                  <td>{lead.owner || "—"}</td>
                  <td><div className={styles.rowActions}><button onClick={() => setDraft({ ...lead })} aria-label={`Edit ${lead.clientName}`}><Pencil aria-hidden="true" /></button><button onClick={() => removeLead(lead)} aria-label={`Remove ${lead.clientName}`}><Trash2 aria-hidden="true" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {draft && (
        <EditorPanel title={draft.id ? "Update lead" : "New lead"} subtitle="Client ledger" onClose={() => setDraft(null)}>
          <form className={styles.editorForm} onSubmit={saveLead}>
            <Field label="Client or contact"><input autoFocus maxLength={160} value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} /></Field>
            <Field label="Company"><input maxLength={160} value={draft.company || ""} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></Field>
            <Field label="Email"><input type="email" maxLength={255} value={draft.email || ""} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
            <div className={styles.fieldPair}>
              <Field label="Stage"><select value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })}>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{stage[0].toUpperCase() + stage.slice(1)}</option>)}</select></Field>
              <Field label="Value (INR)"><input type="number" min="0" step="0.01" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></Field>
            </div>
            <div className={styles.fieldPair}>
              <Field label="Follow up"><input type="date" value={draft.followUpOn || ""} onChange={(event) => setDraft({ ...draft, followUpOn: event.target.value })} /></Field>
              <Field label="Owner"><input maxLength={120} value={draft.owner || ""} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></Field>
            </div>
            <Field label="Notes"><textarea rows={5} maxLength={4000} value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
            <button className={styles.primaryButton} disabled={!draft.clientName.trim() || saving}><Save aria-hidden="true" /> {saving ? "Saving..." : "Save lead"}</button>
          </form>
        </EditorPanel>
      )}
    </section>
  );
}

export function NotesStation() {
  const collection = useFounderCollection("/api/founder/notes", "notes", "note");
  const [selectedId, setSelectedId] = useState(null);
  const noteEditGeneration = useRef(0);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const selected = collection.items.find((note) => note.id === selectedId) || collection.items[0] || null;

  const selectNote = (note) => {
    if (draft && (draft.title !== selected?.title || draft.body !== selected?.body) && !window.confirm("Discard unsaved note changes?")) return;
    noteEditGeneration.current++;
    setSelectedId(note.id);
    setDraft({ ...note });
  };

  const beginNote = () => {
    if (draft && (draft.title !== selected?.title || draft.body !== selected?.body) && !window.confirm("Discard unsaved note changes?")) return;
    noteEditGeneration.current++;
    setSelectedId(null);
    setDraft({ title: "", body: "" });
  };

  const activeDraft = draft || (selected ? { ...selected } : null);

  const saveNote = async () => {
    if (!activeDraft?.title.trim() || !activeDraft?.body.trim() || saving) return;
    setSaving(true);
    try {
      const generation = noteEditGeneration.current;
      const saved = await collection.save(activeDraft);
      if (generation === noteEditGeneration.current) { setSelectedId(saved.id); setDraft({ ...saved }); }
    } catch (error) {
      collection.setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async () => {
    if (!activeDraft?.id || !window.confirm(`Remove “${activeDraft.title}”?`)) return;
    try {
      await collection.remove(activeDraft.id);
      setSelectedId(null);
      setDraft(null);
    } catch (error) {
      collection.setError(error.message);
    }
  };

  return (
    <section className={styles.stationViewport}>
      <StationHeader
        index="07"
        label="Founder notes"
        title="Leave the thinking in the room."
        copy="Shared decisions, observations, and ideas—separate from Optimus notes."
        action={<ActionButton onClick={beginNote}><Plus aria-hidden="true" /> New note</ActionButton>}
      />
      <StatusMessage loading={collection.loading} error={collection.error} onRetry={collection.retry} />
      {!collection.loading && !collection.error && collection.items.length === 0 && !draft && <EmptyState>The desk is clear. Write the first founder note.</EmptyState>}
      {(collection.items.length > 0 || activeDraft) && (
        <div className={styles.notesDesk}>
          <nav aria-label="Founder notes">
            {collection.items.map((note) => (
              <button key={note.id} className={selected?.id === note.id ? styles.selectedNote : ""} onClick={() => selectNote(note)}>
                <strong>{note.title}</strong>
                <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(note.updatedAt))}</span>
              </button>
            ))}
          </nav>
          <div className={styles.notePaper}>
            {activeDraft ? (
              <>
                <input disabled={saving} aria-label="Note title" placeholder="Note title" maxLength={160} value={activeDraft.title} onChange={(event) => setDraft({ ...activeDraft, title: event.target.value })} />
                <textarea disabled={saving} maxLength={12000} aria-label="Note content" placeholder="Write the thought clearly..." value={activeDraft.body} onChange={(event) => setDraft({ ...activeDraft, body: event.target.value })} />
                <footer><span>{activeDraft.body.length} characters</span><div>{activeDraft.id && <button disabled={saving} onClick={removeNote} aria-label="Delete note"><Trash2 aria-hidden="true" /></button>}<button className={styles.noteSave} onClick={saveNote} disabled={!activeDraft.title.trim() || !activeDraft.body.trim() || saving}><Check aria-hidden="true" /> {saving ? "Saving" : "Save note"}</button></div></footer>
              </>
            ) : <p>Select a note or begin a new one.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
