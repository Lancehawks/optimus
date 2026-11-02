"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError, notificationService } from "@/services/api";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";

const DEFAULT_POLL_INTERVAL = process.env.NODE_ENV === "development"
  ? 0
  : 10 * 60 * 1000;

const SUMMARY_KEY = ["notifications", "summary"];
const SIGNED_OUT_SUMMARY = {
  unreadCount: 0,
  notifications: [],
  preferences: normalizeNotificationPreferences(),
};

async function loadSummary() {
  try {
    const data = await notificationService.list({
      status: "unread",
      limit: "10",
    });
    return {
      unreadCount: data.unreadCount || 0,
      notifications: data.notifications || [],
      preferences: normalizeNotificationPreferences(data.preferences),
    };
  } catch (error) {
    if (isUnauthorizedError(error)) return SIGNED_OUT_SUMMARY;
    throw error;
  }
}

export function useNotificationSummary({ pollInterval = DEFAULT_POLL_INTERVAL } = {}) {
  const queryClient = useQueryClient();
  // Polls only while the tab is visible, and refreshes when it becomes visible.
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: loadSummary,
    refetchInterval: pollInterval > 0 ? pollInterval : false,
  });

  const fetchSummary = useCallback(() => refetch({ cancelRefetch: false }), [refetch]);
  const setUnreadCount = useCallback((update) => {
    queryClient.setQueryData(SUMMARY_KEY, (current = SIGNED_OUT_SUMMARY) => ({
      ...current,
      unreadCount: typeof update === "function" ? update(current.unreadCount) : update,
    }));
  }, [queryClient]);

  const summary = data ?? SIGNED_OUT_SUMMARY;
  return {
    fetchSummary,
    error,
    isLoading,
    notifications: summary.notifications,
    preferences: summary.preferences,
    setUnreadCount,
    unreadCount: summary.unreadCount,
  };
}
