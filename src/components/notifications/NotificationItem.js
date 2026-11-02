"use client";

import { useEffect, useRef } from "react";
import { Avatar, Button } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import {
  getNotificationActionLabel,
  getNotificationBody,
  getNotificationHeadline,
  getNotificationPerson,
  getNotificationPersonName,
  isUnreadNotification,
  isInvitationNotification,
  isPendingInvitationNotification,
} from "@/components/notifications/notificationDisplay";

const VISIBLE_READ_DELAY_MS = 4000;

export default function NotificationItem({
  notification,
  actionId,
  onOpen,
  onInvitation,
  onVisible,
}) {
  const itemRef = useRef(null);
  const reportedVisibleRef = useRef(false);
  const invitation = isInvitationNotification(notification);
  const pendingInvitation = isPendingInvitationNotification(notification);
  const canOpen = !pendingInvitation;
  const person = getNotificationPerson(notification);
  const personName = getNotificationPersonName(notification);
  const unread = isUnreadNotification(notification);
  const openLoading = actionId === `${notification.id}:open`;
  const acceptLoading = actionId === `${notification.id}:accept`;
  const declineLoading = actionId === `${notification.id}:decline`;

  useEffect(() => {
    reportedVisibleRef.current = false;
  }, [notification.id]);

  useEffect(() => {
    if (!onVisible || invitation || !unread) return;

    const node = itemRef.current;
    if (!node) return;

    let readTimer = null;
    const clearReadTimer = () => {
      if (readTimer) {
        clearTimeout(readTimer);
        readTimer = null;
      }
    };

    const reportVisible = () => {
      if (reportedVisibleRef.current) return;
      reportedVisibleRef.current = true;
      onVisible(notification);
    };

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      readTimer = setTimeout(reportVisible, VISIBLE_READ_DELAY_MS);
      return clearReadTimer;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          clearReadTimer();
          readTimer = setTimeout(reportVisible, VISIBLE_READ_DELAY_MS);
        } else {
          clearReadTimer();
        }
      },
      { threshold: [0, 0.65, 1] }
    );

    observer.observe(node);

    return () => {
      clearReadTimer();
      observer.disconnect();
    };
  }, [invitation, notification, onVisible, unread]);

  return (
    <div
      ref={itemRef}
      className={cn("relative px-4 py-3 transition-colors", canOpen && "cursor-pointer hover:bg-surface-secondary")}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={() => {
        if (canOpen) onOpen(notification);
      }}
      onKeyDown={(event) => {
        if (canOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(notification);
        }
      }}
    >
      {unread && <span className="absolute left-1.5 top-[1.15rem] h-1.5 w-1.5 rounded-full bg-brand-500" aria-label="Unread" />}
      <div className="flex gap-3">
        <Avatar src={person?.avatar_url} name={personName} alt={personName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm leading-5", unread ? "font-medium text-heading" : "text-body")}>
            {getNotificationHeadline(notification)}
          </p>
          <p className="mt-0.5 text-xs text-muted">{getNotificationBody(notification)}</p>
          <p className="mt-1 font-mono text-2xs text-placeholder">{formatDate(notification.created_at)}</p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {pendingInvitation ? (
              <>
                <Button
                  size="xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInvitation(notification, "accept");
                  }}
                  isLoading={acceptLoading}
                  disabled={!!actionId}
                >
                  Accept
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInvitation(notification, "decline");
                  }}
                  isLoading={declineLoading}
                  disabled={!!actionId}
                >
                  Decline
                </Button>
              </>
            ) : invitation ? (
              notification.project?.id ? (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(notification);
                  }}
                  isLoading={openLoading}
                  disabled={!!actionId}
                >
                  Open project
                </Button>
              ) : null
            ) : (
              <Button
                size="xs"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(notification);
                }}
                isLoading={openLoading}
                disabled={!!actionId}
              >
                {getNotificationActionLabel(notification)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
