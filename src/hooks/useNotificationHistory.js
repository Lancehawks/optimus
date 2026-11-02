"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationHref,
  getInvitationId,
  isPendingInvitationNotification,
  isUnreadNotification,
} from "@/components/notifications/notificationDisplay";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";
import { isUnauthorizedError, notificationService } from "@/services/api";
import { useToast } from "@/components/ui";

const PREFERENCES_KEY = ["notifications", "preferences"];
const NO_HISTORY = { notifications: [], unreadCount: 0 };

async function loadHistory(filter) {
  try {
    const data = await notificationService.list({ status: filter, limit: "50" });
    return { notifications: data.notifications || [], unreadCount: data.unreadCount || 0 };
  } catch (error) {
    if (isUnauthorizedError(error)) return NO_HISTORY;
    throw error;
  }
}

async function loadPreferences() {
  try {
    return normalizeNotificationPreferences((await notificationService.getPreferences()).preferences);
  } catch (error) {
    if (isUnauthorizedError(error)) return normalizeNotificationPreferences();
    throw error;
  }
}

export function useNotificationHistory({
  onClose,
  onNavigate,
  onUnreadCountChange,
} = {}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [savingPreference, setSavingPreference] = useState(null);
  const [actionId, setActionId] = useState(null);
  const { addToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["notifications", "history", activeFilter],
    queryFn: () => loadHistory(activeFilter),
  });
  const preferencesQuery = useQuery({ queryKey: PREFERENCES_KEY, queryFn: loadPreferences });
  const { notifications, unreadCount } = history.data ?? NO_HISTORY;
  const preferences = preferencesQuery.data ?? normalizeNotificationPreferences();
  const refetchHistory = history.refetch;
  const loadNotifications = useCallback(() => refetchHistory({ cancelRefetch: false }), [refetchHistory]);

  const historyError = history.error;
  const preferencesError = preferencesQuery.error;
  useEffect(() => {
    if (historyError) addToast({ message: historyError.message, type: "error" });
  }, [addToast, historyError]);
  useEffect(() => {
    if (preferencesError) addToast({ message: preferencesError.message, type: "error" });
  }, [addToast, preferencesError]);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  const markManyAsRead = useCallback(async (ids, { silent = false } = {}) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    try {
      const data = await notificationService.markManyRead(uniqueIds);
      const readIds = new Set(data.ids?.length ? data.ids : uniqueIds);
      const readAt = new Date().toISOString();

      queryClient.setQueryData(["notifications", "history", activeFilter], (current = NO_HISTORY) => ({
        notifications: activeFilter === "unread"
          ? current.notifications.filter((notification) => !readIds.has(notification.id))
          : current.notifications.map((notification) =>
            readIds.has(notification.id)
              ? { ...notification, read_at: notification.read_at || readAt }
              : notification
          ),
        unreadCount: Math.max(0, current.unreadCount - readIds.size),
      }));
    } catch (error) {
      if (!silent) {
        addToast({ message: error.message, type: "error" });
      }
      await loadNotifications();
    }
  }, [activeFilter, addToast, loadNotifications, queryClient]);

  const notificationNeedsAction = useCallback((notification) => {
    return isPendingInvitationNotification(notification);
  }, []);

  const markNotificationSeen = useCallback((notification) => {
    if (!preferences.markReadOnView) return;
    if (notificationNeedsAction(notification) || !isUnreadNotification(notification)) return;

    markManyAsRead([notification.id], { silent: true });
  }, [markManyAsRead, notificationNeedsAction, preferences.markReadOnView]);

  const markAllRead = useCallback(async () => {
    const readableIds = notifications
      .filter((notification) => !notificationNeedsAction(notification) && isUnreadNotification(notification))
      .map((notification) => notification.id);

    if (readableIds.length === 0) return;

    await markManyAsRead(readableIds);
    addToast({ message: "Notifications marked read", type: "success" });
  }, [addToast, markManyAsRead, notificationNeedsAction, notifications]);

  const hasReadableUnreadNotifications = notifications.some(
    (notification) => !notificationNeedsAction(notification) && isUnreadNotification(notification)
  );

  const updatePreference = async (key, value) => {
    const previousPreferences = preferences;
    const nextPreferences = normalizeNotificationPreferences({
      ...preferences,
      [key]: value,
    });

    queryClient.setQueryData(PREFERENCES_KEY, nextPreferences);
    setSavingPreference(key);

    try {
      const data = await notificationService.updatePreferences(nextPreferences);
      queryClient.setQueryData(PREFERENCES_KEY, normalizeNotificationPreferences(data.preferences));
      await loadNotifications();
    } catch (error) {
      queryClient.setQueryData(PREFERENCES_KEY, previousPreferences);
      addToast({ message: error.message, type: "error" });
    } finally {
      setSavingPreference(null);
    }
  };

  const handleInvitation = async (notification, action) => {
    setActionId(`${notification.id}:${action}`);
    try {
      await notificationService.respondToProjectInvitation(getInvitationId(notification), action);
      await loadNotifications();
      addToast({
        message: action === "accept" ? `Joined ${notification.project.name}` : "Invitation declined",
        type: action === "accept" ? "success" : "info",
      });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setActionId(null);
    }
  };

  const openNotification = async (notification) => {
    if (isPendingInvitationNotification(notification)) return;

    setActionId(`${notification.id}:open`);
    try {
      if (!notification.read_at) {
        await markManyAsRead([notification.id], { silent: true });
      }

      onClose?.();
      onNavigate?.();
      router.push(getNotificationHref(notification));
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setActionId(null);
    }
  };

  return {
    activeFilter,
    actionId,
    handleInvitation,
    hasReadableUnreadNotifications,
    isLoading: history.isFetching,
    isLoadingPreferences: preferencesQuery.isLoading,
    markAllRead,
    markNotificationSeen,
    notifications,
    openNotification,
    preferences,
    preferencesOpen,
    savingPreference,
    setActiveFilter,
    setPreferencesOpen,
    unreadCount,
    updatePreference,
  };
}
