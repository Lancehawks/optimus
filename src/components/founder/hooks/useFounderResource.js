"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestFounderJson } from "../services/founderApi";

/**
 * Loads `result[key]` from a founder endpoint. `loading` is true only until
 * the first response; `reload()` refetches in the background.
 * @param {string} url
 * @param {string} key
 * @param {{ initialData?: any, fallbackError?: string }} [options]
 */
export function useFounderResource(url, key, { initialData = null, fallbackError } = {}) {
  const initialRef = useRef(initialData);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    requestFounderJson(url, { fallbackError })
      .then((result) => {
        if (!active) return;
        setData(result[key] ?? initialRef.current);
        setError("");
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [url, key, fallbackError, reloadToken]);

  /** Accept a fresh value from a successful write. */
  const receive = useCallback((next) => {
    setData(next);
    setError("");
    setLoading(false);
  }, []);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  return { data, setData, receive, loading, error, setError, reload };
}
