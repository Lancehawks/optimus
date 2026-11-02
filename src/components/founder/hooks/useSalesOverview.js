"use client";

import { useEffect, useState } from "react";
import { FOUNDER_DATA_CHANGED_EVENT, FOUNDER_ENDPOINTS, requestFounderJson } from "../services/founderApi";

/**
 * Leads and settings for the sales overview. Refreshes after any lead write
 * and on window focus; responses from superseded requests are ignored.
 */
export function useSalesOverview() {
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const [leadResult, settingResult] = await Promise.all([
          requestFounderJson(FOUNDER_ENDPOINTS.leads),
          requestFounderJson(FOUNDER_ENDPOINTS.settings),
        ]);
        if (!active || request !== generation) return;
        setLeads(leadResult.leads || []);
        setSettings(settingResult.settings);
        setError("");
      } catch (loadError) {
        if (active && request === generation) setError(loadError.message);
      } finally {
        if (active && request === generation) setLoading(false);
      }
    };
    const changed = (event) => { if (event.detail === FOUNDER_ENDPOINTS.leads) load(); };
    load();
    window.addEventListener(FOUNDER_DATA_CHANGED_EVENT, changed);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener(FOUNDER_DATA_CHANGED_EVENT, changed);
      window.removeEventListener("focus", load);
    };
  }, []);

  return { leads, settings, setSettings, loading, error, setError };
}
