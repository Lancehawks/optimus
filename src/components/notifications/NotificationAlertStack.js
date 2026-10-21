"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getNotificationHeadline } from "@/components/notifications/notificationDisplay";
import { BellIcon } from "@/components/notifications/NotificationIcons";

export default function NotificationAlertStack({ alerts, onOpen }) {
  const [mounted, setMounted] = useState(false);
  const latestAlert = alerts[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !latestAlert) return null;

  const alertCount = alerts.length;
  const headline = getNotificationHeadline(latestAlert);

  return createPortal(
    <div className="fixed right-4 top-16 z-[120] lg:top-5">
      <button
        type="button"
        onClick={() => onOpen(latestAlert)}
        className="flex max-w-xs animate-slide-down cursor-pointer items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-2 pr-3.5 text-left shadow-md transition-colors hover:border-border-strong"
        aria-label={alertCount > 1 ? `${alertCount} new notifications` : headline}
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <BellIcon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 truncate text-sm font-medium text-heading">
          {alertCount > 1 ? `${alertCount} new notifications` : headline}
        </span>
      </button>
    </div>,
    document.body
  );
}
