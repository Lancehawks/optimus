"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { googleService } from "@/services/api";

const STATUS_KEY = ["google", "status"];
const DISCONNECTED = { connected: false, email: null, connectedAt: null };

export function useGoogleConnection() {
  const queryClient = useQueryClient();
  // A failed check keeps the last known status (disconnected before any).
  const { data, isLoading, refetch } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => googleService.getStatus(),
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const connect = async () => {
    const data = await googleService.getAuthUrl();
    window.location.href = data.url;
  };

  const disconnect = async () => {
    await googleService.disconnect();
    queryClient.setQueryData(STATUS_KEY, DISCONNECTED);
  };

  // The sync's write refreshes the status, calendars and events.
  const sync = async () => {
    setIsSyncing(true);
    try {
      return await googleService.sync();
    } finally {
      setIsSyncing(false);
    }
  };

  return { status: data ?? DISCONNECTED, isLoading, isSyncing, connect, disconnect, sync, refetch };
}
