"use client";

import { useQuery } from "@tanstack/react-query";
import { FOUNDER_ENDPOINTS, requestFounderJson } from "@/components/founder/services/founderApi";

// The countdown stays behind the Founder Lobby PIN: this reads the lobby's own
// guarded route, so a session that hasn't unlocked the lobby only learns "locked".
async function loadCountdown() {
  try {
    const { countdown } = await requestFounderJson(FOUNDER_ENDPOINTS.countdown);
    return { countdown };
  } catch (error) {
    if (error.status === 403) return { locked: true };
    throw error;
  }
}

export function useFounderCountdown() {
  // Always rechecked when Today shows or the window regains focus: that picks
  // up an unlock or a new target from the lobby, and hides the countdown once
  // the 4-hour grant has lapsed.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["founder", "countdown"],
    queryFn: loadCountdown,
    staleTime: 0,
  });

  const status = isLoading ? "loading" : data?.locked ? "locked" : data?.countdown ? "ready" : "unavailable";
  return { status, countdown: data?.countdown ?? null, refetch };
}
