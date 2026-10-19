"use client";

import { requestFounderJson } from "../services/founderApi";
import { useFounderResource } from "./useFounderResource";

const NO_ITEMS = [];

/**
 * A shared, versioned founder collection (milestones, targets, leads, notes).
 * Saved items are re-sorted with `compare` to match the API's ordering.
 */
export function useFounderCollection(endpoint, key, itemKey, compare) {
  const { data: items, setData: setItems, loading, error, setError, reload } =
    useFounderResource(endpoint, key, { initialData: NO_ITEMS });

  const save = async (item) => {
    setError("");
    const isExisting = Boolean(item.id);
    const result = await requestFounderJson(endpoint, { method: isExisting ? "PUT" : "POST", body: item });
    const saved = result[itemKey];
    setItems((current) => {
      const next = isExisting
        ? current.map((entry) => entry.id === saved.id ? saved : entry)
        : [...current, saved];
      return compare ? next.sort(compare) : next;
    });
    return saved;
  };

  // The row version makes a delete fail with 409 if another founder changed it.
  const remove = async (item) => {
    setError("");
    await requestFounderJson(`${endpoint}?id=${encodeURIComponent(item.id)}&version=${encodeURIComponent(item.version || "")}`, { method: "DELETE" });
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  };

  return { items, loading, error, setError, retry: reload, save, remove };
}
