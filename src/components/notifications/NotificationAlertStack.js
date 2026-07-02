"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { getNotificationHeadline } from "@/components/notifications/notificationDisplay";
import { BellIcon } from "@/components/notifications/NotificationIcons";

const ALERT_DURATION_MS = 12000;

export default function NotificationAlertStack({ alerts, onDismiss, onOpen }) {
  const [mounted, setMounted] = useState(false);
  const latestAlert = alerts[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!latestAlert) return;

    const timer = setTimeout(() => {
      onDismiss(latestAlert.id);
    }, ALERT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [latestAlert, onDismiss]);

  if (!mounted || !latestAlert) return null;

  const alertCount = alerts.length;

  return createPortal(
    <div className="fixed right-4 top-16 z-[120] lg:top-4">
      <button
        type="button"
        onClick={() => onOpen(latestAlert)}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full border border-brand-500/35",
          "bg-surface-raised/95 text-brand-400 shadow-2xl backdrop-blur-lg transition-transform hover:scale-105",
          "animate-slide-down ring-4 ring-brand-500/10 cursor-pointer"
        )}
        title={getNotificationHeadline(latestAlert)}
        aria-label={
          alertCount > 1
            ? `${alertCount} new notifications`
            : getNotificationHeadline(latestAlert)
        }
      >
        <span className="absolute inset-0 rounded-full bg-brand-500/10 animate-ping" />
        <span className="relative">
          <BellIcon />
        </span>
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
          {alertCount > 9 ? "9+" : alertCount}
        </span>
      </button>
    </div>,
    document.body
  );
}
