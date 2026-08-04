"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUnauthorizedError, notificationService } from "@/services/api";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";

const DEFAULT_POLL_INTERVAL = process.env.NODE_ENV === "development"
  ? 0
  : 10 * 60 * 1000;

export function useNotificationSummary({ pollInterval = DEFAULT_POLL_INTERVAL } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(() => normalizeNotificationPreferences());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchInFlightRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    setError(null);

    try {
      const data = await notificationService.list({
        status: "unread",
        limit: "10",
      });
      setUnreadCount(data.unreadCount || 0);
      setNotifications(data.notifications || []);
      if (data.preferences) {
        setPreferences(normalizeNotificationPreferences(data.preferences));
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setUnreadCount(0);
        setNotifications([]);
        setPreferences(normalizeNotificationPreferences());
        return;
      }
      setError(error);
      console.error("Failed to fetch notification summary:", error);
    } finally {
      fetchInFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    const refreshWhileVisible = () => {
      if (document.visibilityState === "visible") void fetchSummary();
    };
    const timer = pollInterval > 0
      ? window.setInterval(refreshWhileVisible, pollInterval)
      : null;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchSummary();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchSummary, pollInterval]);

  return {
    fetchSummary,
    error,
    isLoading,
    notifications,
    preferences,
    setUnreadCount,
    unreadCount,
  };
}
