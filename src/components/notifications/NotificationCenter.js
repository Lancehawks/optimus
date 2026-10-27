"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { notificationService } from "@/services/api";
import { useNotificationAlerts } from "@/hooks/useNotificationAlerts";
import { useNotificationSummary } from "@/hooks/useNotificationSummary";
import {
  getNotificationHref,
  isInvitationNotification,
  isUnreadNotification,
} from "@/components/notifications/notificationDisplay";
import NotificationAlertStack from "@/components/notifications/NotificationAlertStack";
import NotificationHistory from "@/components/notifications/NotificationHistory";
import { BellIcon } from "@/components/notifications/NotificationIcons";
import { navItemClass } from "@/components/layout/navStyles";

export default function NotificationCenter({ isCollapsed = false, onNavigate, showAlerts = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const router = useRouter();
  const { error, fetchSummary, isLoading, notifications, preferences, setUnreadCount, unreadCount } =
    useNotificationSummary();
  const { alerts, clearAlerts, dismissAlert } = useNotificationAlerts(notifications, {
    disabled: isOpen || !showAlerts,
    ready: !isLoading,
    soundEnabled: preferences.soundEnabled,
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const handleAlertOpen = async (notification) => {
    dismissAlert(notification.id);

    if (isInvitationNotification(notification)) {
      setIsOpen(true);
      return;
    }

    if (isUnreadNotification(notification)) {
      try {
        await notificationService.markManyRead([notification.id]);
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (requestError) {
        console.error("Notification alert read error:", requestError);
      }
    }

    onNavigate?.();
    router.push(getNotificationHref(notification));
  };

  const toggle = () => {
    setIsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        clearAlerts();
        void fetchSummary();
      }
      return nextOpen;
    });
  };

  return (
    <div ref={panelRef} className="relative">
      {showAlerts && !isOpen && <NotificationAlertStack alerts={alerts} onOpen={handleAlertOpen} />}

      <button
        type="button"
        onClick={toggle}
        className={navItemClass({ active: isOpen, collapsed: isCollapsed })}
        title={isCollapsed ? "Notifications" : undefined}
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <span className="relative flex">
          <BellIcon />
          {unreadCount > 0 && isCollapsed && (
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 ring-2 ring-canvas" />
          )}
        </span>
        {!isCollapsed && <span className="flex-1 truncate">Notifications</span>}
        {!isCollapsed && unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 font-mono text-3xs font-medium tabular-nums text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            "z-50 flex animate-slide-down flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg",
            "fixed inset-x-3 bottom-3 top-16 lg:absolute lg:inset-auto lg:bottom-0 lg:left-full lg:top-auto lg:ml-3 lg:max-h-[min(36rem,calc(100dvh-2rem))] lg:w-[24rem]"
          )}
        >
          {error && (
            <div className="flex items-center justify-between gap-3 border-b border-danger/20 bg-danger-light px-4 py-2.5 text-xs text-danger" role="alert">
              <span>Notifications could not be refreshed.</span>
              <button type="button" className="cursor-pointer font-medium underline" onClick={fetchSummary}>
                Retry
              </button>
            </div>
          )}
          <NotificationHistory
            className="min-h-0 flex-1"
            onClose={() => setIsOpen(false)}
            onNavigate={onNavigate}
            onUnreadCountChange={setUnreadCount}
          />
        </div>
      )}
    </div>
  );
}
