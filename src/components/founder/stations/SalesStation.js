"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Pencil } from "lucide-react";
import { formatFounderMoney as formatMoney } from "@/lib/founderValues";
import { useSalesOverview } from "../hooks/useSalesOverview";
import { FOUNDER_ENDPOINTS, requestFounderJson } from "../services/founderApi";
import { cx } from "../utils/cx";
import { padNumber } from "../utils/format";
import { computeSalesMetrics, isValidSalesTarget, salesTargetProgress } from "../utils/salesMetrics";
import { EditorForm } from "./shared/EditorPanel";
import { ActionButton, Field, FormNote, SaveButton, StationHeader, StatusMessage } from "./shared/StationUi";
import station from "./shared/station.module.css";
import styles from "./SalesStation.module.css";

export function SalesStation() {
  const { leads, settings, setSettings, loading, error, setError } = useSalesOverview();
  // Number when seeded from settings, string while the founder types.
  const [target, setTarget] = useState(/** @type {number | string} */ (0));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const metrics = useMemo(() => computeSalesMetrics(leads), [leads]);
  const hasTarget = settings?.salesTarget > 0;
  const progress = salesTargetProgress(metrics.wonValue, settings?.salesTarget);

  // Seed the draft when the editor opens; the background refresh on window
  // focus must not overwrite a target the founder is typing.
  const openEditor = () => {
    setTarget(settings?.salesTarget || 0);
    setEditing(true);
  };

  const saveSalesTarget = async (event) => {
    event.preventDefault();
    if (!isValidSalesTarget(target) || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await requestFounderJson(FOUNDER_ENDPOINTS.settings, {
        method: "PUT",
        body: { salesTarget: Number(target), salesCurrency: "INR" },
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
    <section className={station.stationViewport}>
      <StationHeader
        index="05"
        label="Sales"
        title="Commercial overview"
        copy="Revenue, pipeline health, and lead movement in one clear view."
        action={<ActionButton onClick={openEditor}><Pencil aria-hidden="true" /> Sales target</ActionButton>}
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
              <strong>{formatMoney(metrics.wonValue)}</strong>
              <div className={cx(styles.salesTrack, station.progressTrack)} aria-label={`${Math.round(progress)}% of sales target`}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className={styles.targetCaption}>
                <span>{hasTarget ? `${Math.round(progress)}% achieved` : "No target set"}</span>
                <span>{hasTarget ? `Target ${formatMoney(settings.salesTarget)}` : "Add a target to track progress"}</span>
              </div>
            </div>
            <div className={styles.salesReadings}>
              <div><span>Pipeline value</span><strong>{formatMoney(metrics.pipelineValue)}</strong><small>Across active leads</small></div>
              <div><span>Open leads</span><strong>{padNumber(metrics.openCount)}</strong><small>Still in motion</small></div>
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
                    <small>{formatMoney(stage.value)}</small>
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
        <EditorForm title="Set the sales target" subtitle="Commercial control" onClose={() => setEditing(false)} onSubmit={saveSalesTarget}>
          <Field label="Target value"><input type="number" min="0" step="any" value={target} onChange={(event) => setTarget(event.target.value)} /></Field>
          <FormNote>All commercial values are in Indian rupees (INR).</FormNote>
          <FormNote>Closed value is calculated from leads marked Won.</FormNote>
          <SaveButton disabled={!isValidSalesTarget(target)} saving={saving}>Save sales target</SaveButton>
        </EditorForm>
      )}
    </section>
  );
}
