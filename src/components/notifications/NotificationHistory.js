"use client";

import { Settings2 } from "lucide-react";
import { Button, Spinner, Tabs } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import NotificationItem from "@/components/notifications/NotificationItem";
import NotificationPreferencesPanel from "@/components/notifications/NotificationPreferencesPanel";
import { CloseIcon, HistoryIcon } from "@/components/notifications/NotificationIcons";
import { notificationFilters } from "@/components/notifications/notificationDisplay";

export default function NotificationHistory({ className, onClose, onNavigate, onUnreadCountChange }) {
  const {
    activeFilter,
    actionId,
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
  } = useNotificationHistory({ onClose, onNavigate, onUnreadCountChange });

  return (
    <section className={cn("flex h-full flex-col bg-surface", className)} aria-label="Notifications">
      <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[0.9375rem] font-semibold text-heading">Notifications</h2>
          {unreadCount > 0 && <span className="font-mono text-xs tabular-nums text-muted">{unreadCount} unread</span>}
        </div>
        <div className="flex items-center gap-0.5">
          {isLoading && <Spinner size="sm" className="mr-1" />}
          {hasReadableUnreadNotifications && (
            <Button type="button" size="xs" variant="ghost" onClick={markAllRead} disabled={!!actionId}>
              Mark all read
            </Button>
          )}
          <button
            type="button"
            onClick={() => setPreferencesOpen((open) => !open)}
            disabled={isLoadingPreferences}
            aria-pressed={preferencesOpen}
            aria-label="Notification preferences"
            className={cn(
              "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-tertiary hover:text-heading",
              preferencesOpen ? "bg-surface-tertiary text-heading" : "text-muted"
            )}
          >
            <Settings2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-tertiary hover:text-heading"
              aria-label="Close notifications"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pb-3">
        <Tabs
          size="sm"
          tabs={notificationFilters.map((filter) => ({ key: filter.value, label: filter.label }))}
          activeTab={activeFilter}
          onChange={setActiveFilter}
        />
      </div>

      {preferencesOpen && (
        <NotificationPreferencesPanel
          preferences={preferences}
          savingPreference={savingPreference}
          onChange={updatePreference}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border scrollbar-thin">
        {!isLoading && notifications.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted">
              <HistoryIcon />
            </span>
            <p className="font-serif text-lg text-heading">All quiet</p>
            <p className="mt-1 text-xs text-muted">Project invitations will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <NotificationItem
                key={`${notification.type}:${notification.id}`}
                notification={notification}
                actionId={actionId}
                onOpen={openNotification}
                onInvitation={handleInvitation}
                onVisible={markNotificationSeen}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
