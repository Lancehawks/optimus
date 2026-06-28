"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUnauthorizedError, notificationService } from "@/services/api";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";

export function useNotificationSummary({ pollInterval = 30000 } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(() => normalizeNotificationPreferences());
  const [isLoading, setIsLoading] = useState(true);
  const fetchInFlightRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;

    try {
      try {
        await notificationService.syncLive();
      } catch (error) {
        if (isUnauthorizedError(error)) throw error;
        console.error("Failed to sync live notification reminders:", error);
      }

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
      console.error("Failed to fetch notification summary:", error);
    } finally {
      fetchInFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(fetchSummary, pollInterval);
    return () => clearInterval(timer);
  }, [fetchSummary, pollInterval]);

  return {
    fetchSummary,
    isLoading,
    notifications,
    preferences,
    setUnreadCount,
    unreadCount,
  };
}
