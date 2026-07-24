"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUnreadNotification } from "@/components/notifications/notificationDisplay";
import { useNotificationSound } from "@/hooks/useNotificationSound";

const MAX_ALERTS = 3;
const INITIAL_ALERT_WINDOW_MS = 30000;

function isFreshInitialNotification(notification, startedAt) {
  const createdAt = new Date(notification.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return createdAt >= startedAt - 1000 && createdAt <= Date.now() + 1000;
}

export function useNotificationAlerts(
  notifications,
  { disabled = false, ready = false, soundEnabled = true } = {}
) {
  const [alerts, setAlerts] = useState([]);
  const initializedRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const seenIdsRef = useRef(new Set());
  const playNotificationSound = useNotificationSound();

  useEffect(() => {
    if (!ready) return;

    const unreadNotifications = (notifications || []).filter(isUnreadNotification);

    const markSeen = (items) => {
      items.forEach((notification) => {
        seenIdsRef.current.add(notification.id);
      });

      if (seenIdsRef.current.size > 120) {
        seenIdsRef.current = new Set([...seenIdsRef.current].slice(-80));
      }
    };

    if (!initializedRef.current) {
      initializedRef.current = true;
      const freshInitialAlerts = unreadNotifications.filter((notification) =>
        isFreshInitialNotification(
          notification,
          startedAtRef.current - INITIAL_ALERT_WINDOW_MS
        )
      );
      markSeen(unreadNotifications);

      if (!disabled && freshInitialAlerts.length > 0) {
        setAlerts(freshInitialAlerts.slice(0, MAX_ALERTS));
        if (soundEnabled) {
          playNotificationSound();
        }
      }

      return;
    }

    if (unreadNotifications.length === 0) return;

    if (disabled) {
      markSeen(unreadNotifications);
      return;
    }

    const newAlerts = unreadNotifications.filter(
      (notification) => !seenIdsRef.current.has(notification.id)
    );

    if (newAlerts.length === 0) return;

    markSeen(newAlerts);
    setAlerts((prev) => {
      const existingIds = new Set(prev.map((notification) => notification.id));
      const uniqueNewAlerts = newAlerts.filter((notification) => !existingIds.has(notification.id));
      return [...uniqueNewAlerts, ...prev].slice(0, MAX_ALERTS);
    });
    if (soundEnabled) {
      playNotificationSound();
    }
  }, [disabled, notifications, playNotificationSound, ready, soundEnabled]);

  const dismissAlert = useCallback((notificationId) => {
    setAlerts((prev) => prev.filter((notification) => notification.id !== notificationId));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    clearAlerts,
    dismissAlert,
  };
}
