"use client";

import { useCallback, useEffect } from "react";
import { useApiResource } from "@/hooks/useApiResource";
import { FOUNDER_ENDPOINTS, requestFounderJson } from "@/components/founder/services/founderApi";

// The countdown stays behind the Founder Lobby PIN: this reads the lobby's own
// guarded route, so a session that hasn't unlocked the lobby only learns "locked".
export function useFounderCountdown() {
  const load = useCallback(async () => {
    try {
      const { countdown } = await requestFounderJson(FOUNDER_ENDPOINTS.countdown);
      return { countdown };
    } catch (error) {
      if (error.status === 403) return { locked: true };
      throw error;
    }
  }, []);
  const { data, isLoading, refetch } = useApiResource(load);

  // Picks up an unlock or a new target from another tab, and hides the countdown
  // once the 4-hour grant has lapsed.
  useEffect(() => {
    const refresh = () => void refetch({ background: true });
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refetch]);

  const status = isLoading ? "loading" : data?.locked ? "locked" : data?.countdown ? "ready" : "unavailable";
  return { status, countdown: data?.countdown ?? null, refetch };
}
