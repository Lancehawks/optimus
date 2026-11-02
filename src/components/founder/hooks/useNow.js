"use client";

import { useEffect, useState } from "react";

/** Current time in milliseconds, refreshed every `intervalMs`. */
export function useNow(intervalMs = 1_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
