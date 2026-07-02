"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { notificationService } from "@/services/api";
import { useNotificationAlerts } from "@/hooks/useNotificationAlerts";
import { useNotificationSummary } from "@/hooks/useNotificationSummary";
import {
  getNotificationHref,
  isEventCompletionNotification,
  isInvitationNotification,
  isUnreadNotification,
} from "@/components/notifications/notificationDisplay";
import NotificationAlertStack from "@/components/notifications/NotificationAlertStack";
import NotificationHistory from "@/components/notifications/NotificationHistory";
import { BellIcon } from "@/components/notifications/NotificationIcons";

export default function NotificationCenter({
  variant = "floating",
  isCollapsed = false,
  onNavigate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const isSidebar = variant === "sidebar";
  const router = useRouter();
  const {
    isLoading,
    notifications,
    preferences,
    setUnreadCount,
    unreadCount,
  } = useNotificationSummary();
  const {
    alerts,
    dismissAlert,
  } = useNotificationAlerts(notifications, {
    disabled: isOpen,
    ready: !isLoading,
    soundEnabled: preferences.soundEnabled,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!isSidebar && unreadCount === 0 && !isOpen) {
    return null;
  }

  const handleAlertOpen = async (notification) => {
    dismissAlert(notification.id);

    if (isInvitationNotification(notification) || isEventCompletionNotification(notification)) {
      setIsOpen(true);
      return;
    }

    if (isUnreadNotification(notification)) {
      try {
        await notificationService.markManyRead([notification.id]);
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        console.error("Notification alert read error:", error);
      }
    }

    onNavigate?.();
    router.push(getNotificationHref(notification));
  };

  return (
    <div
      ref={panelRef}
      className={isSidebar ? "relative" : "fixed right-4 top-16 z-40 lg:top-4"}
    >
      <NotificationAlertStack
        alerts={alerts}
        onDismiss={dismissAlert}
        onOpen={handleAlertOpen}
      />

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          isSidebar
            ? "relative flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-[0.8125rem] font-medium text-neutral-200 transition-colors hover:bg-neutral-0/6 hover:text-neutral-0"
            : "relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-raised/95 text-muted shadow-lg transition-colors hover:bg-surface hover:text-heading",
          isSidebar && isOpen && "bg-brand-500/15 text-brand-400",
          isSidebar && isCollapsed && "lg:justify-center lg:px-0",
          !isSidebar && isOpen && "border-brand-500/40 text-heading"
        )}
        title={isSidebar && isCollapsed ? "Notifications" : undefined}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <span className="relative shrink-0">
          <BellIcon />
          {unreadCount > 0 && isCollapsed && (
            <span className="absolute -right-0.5 -top-0.5 hidden h-2 w-2 rounded-full bg-brand-500 lg:block" />
          )}
        </span>
        {isSidebar && (
          <span className={cn(isCollapsed && "lg:hidden")}>Notifications</span>
        )}
        {unreadCount > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white",
              isSidebar ? "ml-auto" : "absolute -right-1 -top-1",
              isCollapsed && "lg:hidden"
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {isLoading && isSidebar && (
          <span className={cn("ml-auto h-1.5 w-1.5 rounded-full bg-neutral-500", isCollapsed && "lg:hidden")} />
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            "z-50 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl animate-slide-down",
            isSidebar
              ? "fixed bottom-4 left-4 right-4 max-h-[calc(100vh-2rem)] lg:absolute lg:bottom-0 lg:left-full lg:right-auto lg:ml-3 lg:w-[26rem]"
              : "absolute right-0 mt-3 w-[min(calc(100vw-2rem),26rem)]"
          )}
        >
          <NotificationHistory
            className="max-h-[calc(100vh-2rem)] overflow-hidden border-0 shadow-none"
            onClose={() => setIsOpen(false)}
            onNavigate={onNavigate}
            onUnreadCountChange={setUnreadCount}
          />
        </div>
      )}
    </div>
  );
}
