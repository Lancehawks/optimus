"use client";

import { useState, useEffect, useCallback } from "react";
import { googleService } from "@/services/api";

export function useGoogleConnection() {
  const [status, setStatus] = useState({ connected: false, email: null, connectedAt: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await googleService.getStatus();
      setStatus(data);
    } catch {
      // Not connected or error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connect = async () => {
    const data = await googleService.getAuthUrl();
    window.location.href = data.url;
  };

  const disconnect = async () => {
    await googleService.disconnect();
    setStatus({ connected: false, email: null, connectedAt: null });
  };

  const sync = async () => {
    setIsSyncing(true);
    try {
      const result = await googleService.sync();
      await fetchStatus();
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  return { status, isLoading, isSyncing, connect, disconnect, sync, refetch: fetchStatus };
}
