"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Avatar, Button, Spinner, useToast } from "@/components/ui";
import { notificationService } from "@/services/api";

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const panelRef = useRef(null);
  const { addToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationService.list();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

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

  const handleInvitation = async (notification, action) => {
    setActionId(`${notification.id}:${action}`);
    try {
      const result = await notificationService.respondToProjectInvitation(notification.id, action);
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));

      if (action === "accept") {
        addToast({
          message: `Joined ${result.invitation?.project_name || notification.project.name}`,
          type: "success",
        });
        if (pathname === "/projects") router.refresh();
      } else {
        addToast({ message: "Invitation declined", type: "info" });
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
      fetchNotifications();
    } finally {
      setActionId(null);
    }
  };

  const handleMarkRead = async (notification, shouldOpenProject = false) => {
    setActionId(`${notification.id}:read`);
    try {
      await notificationService.markRead(notification.id);
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      if (shouldOpenProject && notification.project?.id) {
        router.push("/projects");
      }
    } catch (error) {
      addToast({ message: error.message, type: "error" });
      fetchNotifications();
    } finally {
      setActionId(null);
    }
  };

  const hasNotifications = notifications.length > 0;

  if (!hasNotifications) {
    return null;
  }

  return (
    <div ref={panelRef} className="fixed right-4 top-16 z-40 lg:top-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-xl border shadow-lg transition-colors",
          "bg-surface-raised/95 border-border text-muted hover:text-heading hover:bg-surface",
          isOpen && "text-heading border-brand-500/40"
        )}
        aria-label="Notifications"
      >
        <BellIcon />
        {hasNotifications && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl animate-slide-down">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-h4">Notifications</h2>
                <p className="text-caption text-muted">
                  {hasNotifications ? `${notifications.length} unread` : "No unread notifications"}
                </p>
              </div>
              {isLoading && <Spinner size="sm" />}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
            {!isLoading && notifications.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-tertiary text-muted">
                  <BellIcon />
                </div>
                <p className="text-body-sm text-heading! font-medium">You are all caught up</p>
                <p className="mt-1 text-caption text-muted">Project updates and invitations will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border-light">
                {notifications.map((notification) => {
                  const isInvitation = notification.type === "project_invitation";
                  const person = isInvitation ? notification.inviter : notification.actor;
                  const personName = person?.full_name || person?.email || "Someone";
                  const acceptLoading = actionId === `${notification.id}:accept`;
                  const declineLoading = actionId === `${notification.id}:decline`;
                  const readLoading = actionId === `${notification.id}:read`;

                  return (
                    <div key={notification.id} className="p-4">
                      <div className="flex gap-3">
                        <Avatar
                          src={person?.avatar_url}
                          name={personName}
                          alt={personName}
                          size="md"
                          className="ring-2 ring-surface"
                        />
                        <div className="min-w-0 flex-1">
                          {isInvitation ? (
                            <>
                              <p className="text-body-sm text-heading! font-medium">
                                {personName} invited you to collaborate
                              </p>
                              <p className="mt-1 text-body-sm text-muted!">
                                Join <span className="text-heading!">{notification.project.name}</span> to see shared tasks, notes, and calendar events.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-body-sm text-heading! font-medium">
                                {personName} {notification.title}
                              </p>
                              <p className="mt-1 text-body-sm text-muted!">
                                {notification.project?.name ? (
                                  <>
                                    In <span className="text-heading!">{notification.project.name}</span>
                                  </>
                                ) : (
                                  notification.body || "Project activity update"
                                )}
                              </p>
                            </>
                          )}
                          <p className="mt-1 text-caption text-muted">
                            {formatDate(notification.created_at)}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {isInvitation ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleInvitation(notification, "accept")}
                                  isLoading={acceptLoading}
                                  disabled={!!actionId}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleInvitation(notification, "decline")}
                                  isLoading={declineLoading}
                                  disabled={!!actionId}
                                >
                                  Decline
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkRead(notification, true)}
                                  isLoading={readLoading}
                                  disabled={!!actionId}
                                >
                                  Open project
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleMarkRead(notification)}
                                  isLoading={readLoading}
                                  disabled={!!actionId}
                                >
                                  Read
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
