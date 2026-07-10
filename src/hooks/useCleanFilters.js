"use client";

import { useMemo } from "react";

function getFilterEntries(filters) {
  return Object.entries(filters || {}).sort(([left], [right]) =>
    left.localeCompare(right)
  );
}

function isPresentFilterValue(value) {
  return value !== undefined && value !== null && value !== "";
}

export function useCleanFilters(filters = {}) {
  const filterKey = JSON.stringify(getFilterEntries(filters));

  return useMemo(() => {
    const entries = JSON.parse(filterKey);
    return Object.fromEntries(
      entries.filter(([, value]) => isPresentFilterValue(value))
    );
  }, [filterKey]);
}
