"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useFounderResource } from "../hooks/useFounderResource";
import { FOUNDER_ENDPOINTS, requestFounderJson } from "../services/founderApi";
import { formatLongDate } from "../utils/format";
import { getBuildingDay } from "../utils/time";
import { EditorForm } from "./shared/EditorPanel";
import { ActionButton, Field, FormNote, SaveButton, StationHeader, StatusMessage } from "./shared/StationUi";
import station from "./shared/station.module.css";
import styles from "./BuildingDayStation.module.css";

export function BuildingDayStation() {
  const { data: settings, receive, loading, error, setError } = useFounderResource(FOUNDER_ENDPOINTS.settings, "settings");
  const [startedOn, setStartedOn] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildingDay = getBuildingDay(settings?.companyStartedOn);

  const openEditor = () => {
    setStartedOn(settings?.companyStartedOn || "");
    setEditing(true);
  };

  const saveStartDate = async (event) => {
    event.preventDefault();
    if (!startedOn || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await requestFounderJson(FOUNDER_ENDPOINTS.settings, { method: "PUT", body: { companyStartedOn: startedOn } });
      receive(result.settings);
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
        index="02"
        label="Building day"
        title="The work has a beginning."
        copy="One continuous count from the day the company began."
        action={<ActionButton onClick={openEditor}><Pencil aria-hidden="true" /> Set origin</ActionButton>}
      />
      <StatusMessage loading={loading} error={error} />
      {!loading && (
        <div className={styles.buildingMonument}>
          <p>Day</p>
          <strong>{buildingDay === null ? "---" : Math.max(0, buildingDay)}</strong>
          <div>
            <span>{buildingDay !== null && buildingDay < 1 ? "Until building begins" : "Of building"}</span>
            <small>{settings?.companyStartedOn ? `Since ${formatLongDate(settings.companyStartedOn)}` : "Choose the first day to begin the count"}</small>
          </div>
        </div>
      )}
      {editing && (
        <EditorForm title="Set the first day" subtitle="Building origin" onClose={() => setEditing(false)} onSubmit={saveStartDate}>
          <Field label="Company started on">
            <input type="date" value={startedOn} onChange={(event) => setStartedOn(event.target.value)} />
          </Field>
          <FormNote>This becomes the shared Day 1 for everyone in the room.</FormNote>
          <SaveButton disabled={!startedOn} saving={saving}>Save origin</SaveButton>
        </EditorForm>
      )}
    </section>
  );
}
