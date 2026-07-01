"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNotificationHref,
  getInvitationId,
  isInvitationNotification,
  isPendingEventCompletionNotification,
  isPendingInvitationNotification,
  isUnreadNotification,
} from "@/components/notifications/notificationDisplay";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";
import { isUnauthorizedError, notificationService } from "@/services/api";
import { useToast } from "@/components/ui";

export function useNotificationHistory({
  onClose,
  onNavigate,
  onUnreadCountChange,
} = {}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState(() => normalizeNotificationPreferences());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [savingPreference, setSavingPreference] = useState(null);
  const [actionId, setActionId] = useState(null);
  const { addToast } = useToast();
  const router = useRouter();

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await notificationService.list({
        status: activeFilter,
        limit: "50",
      });
      const nextUnreadCount = data.unreadCount || 0;
      setNotifications(data.notifications || []);
      setUnreadCount(nextUnreadCount);
      if (data.preferences) {
        setPreferences(normalizeNotificationPreferences(data.preferences));
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, addToast]);

  const loadPreferences = useCallback(async () => {
    setIsLoadingPreferences(true);
    try {
      const data = await notificationService.getPreferences();
      setPreferences(normalizeNotificationPreferences(data.preferences));
    } catch (error) {
      if (isUnauthorizedError(error)) return;
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

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

      setNotifications((prev) => {
        if (activeFilter === "unread") {
          return prev.filter((notification) => !readIds.has(notification.id));
        }

        return prev.map((notification) =>
          readIds.has(notification.id)
            ? { ...notification, read_at: notification.read_at || readAt }
            : notification
        );
      });
      setUnreadCount((prev) => {
        return Math.max(0, prev - readIds.size);
      });
    } catch (error) {
      if (!silent) {
        addToast({ message: error.message, type: "error" });
      }
      await loadNotifications();
    }
  }, [activeFilter, addToast, loadNotifications]);

  const notificationNeedsAction = useCallback((notification) => {
    return isPendingInvitationNotification(notification) || isPendingEventCompletionNotification(notification);
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

    setPreferences(nextPreferences);
    setSavingPreference(key);

    try {
      const data = await notificationService.updatePreferences(nextPreferences);
      setPreferences(normalizeNotificationPreferences(data.preferences));
      await loadNotifications();
    } catch (error) {
      setPreferences(previousPreferences);
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

  const handleEventCompletion = async (notification, status) => {
    setActionId(`${notification.id}:${status}`);
    try {
      await notificationService.respondToEventCompletion(notification.id, status);
      await loadNotifications();
      addToast({
        message: status === "done" ? "Event marked done" : "Event marked missed",
        type: status === "done" ? "success" : "info",
      });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setActionId(null);
    }
  };

  const openNotification = async (notification) => {
    if (isPendingInvitationNotification(notification) || isPendingEventCompletionNotification(notification)) return;

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
    handleEventCompletion,
    handleInvitation,
    hasReadableUnreadNotifications,
    isLoading,
    isLoadingPreferences,
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
