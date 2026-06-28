"use client";

import { useEffect, useRef } from "react";
import { Avatar, Badge, Button } from "@/components/ui";
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
import { AlertIcon } from "@/components/notifications/NotificationIcons";

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
  const isTimeAlert = notification.type === "time_alert";
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
      className={cn(
        "rounded-lg border px-3 py-3 transition-colors",
        canOpen && "cursor-pointer hover:bg-surface-tertiary/60",
        unread
          ? "border-brand-500/30 bg-brand-500/5"
          : "border-border bg-surface-secondary/70"
      )}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={() => {
        if (canOpen) {
          onOpen(notification);
        }
      }}
      onKeyDown={(event) => {
        if (canOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(notification);
        }
      }}
    >
      <div className="flex gap-3">
        {isTimeAlert ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-light text-amber-500 ring-2 ring-surface">
            <AlertIcon />
          </div>
        ) : (
          <Avatar
            src={person?.avatar_url}
            name={personName}
            alt={personName}
            size="sm"
            className="ring-2 ring-surface"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-body-sm text-heading! font-medium leading-snug">
              {getNotificationHeadline(notification)}
            </p>
            <Badge variant={unread ? "info" : "neutral"} size="sm">
              {unread ? "Unread" : "Read"}
            </Badge>
          </div>

          <p className="text-caption text-muted! mt-1">
            {getNotificationBody(notification)}
          </p>
          <p className="text-caption mt-1">{formatDate(notification.created_at)}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {pendingInvitation ? (
              <>
                <Button
                  size="sm"
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
                  size="sm"
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
                  size="sm"
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
                size="sm"
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
