"use client";

import { Button, Card, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import NotificationItem from "@/components/notifications/NotificationItem";
import NotificationPreferencesPanel from "@/components/notifications/NotificationPreferencesPanel";
import { CloseIcon, HistoryIcon } from "@/components/notifications/NotificationIcons";
import { notificationFilters } from "@/components/notifications/notificationDisplay";

export default function NotificationHistory({
  className,
  onClose,
  onNavigate,
  onUnreadCountChange,
}) {
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
    <Card className={cn("h-full", className)}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
            <HistoryIcon />
          </div>
          <div>
            <h2 className="text-h3">Notifications</h2>
            <p className="text-caption mt-1">
              {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "No unread updates"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Spinner size="sm" />}
          {hasReadableUnreadNotifications && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={markAllRead}
              disabled={!!actionId}
            >
              Mark all read
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={preferencesOpen ? "secondary" : "ghost"}
            onClick={() => setPreferencesOpen((open) => !open)}
            disabled={isLoadingPreferences}
          >
            Preferences
          </Button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-heading cursor-pointer"
              aria-label="Close notifications"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="flex rounded-lg bg-surface-secondary p-1 mb-4">
        {notificationFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setActiveFilter(filter.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              activeFilter === filter.value
                ? "bg-surface-raised text-heading shadow-sm"
                : "text-muted hover:text-heading"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {preferencesOpen && (
        <NotificationPreferencesPanel
          preferences={preferences}
          savingPreference={savingPreference}
          onChange={updatePreference}
        />
      )}

      <div className="max-h-[28rem] overflow-y-auto scrollbar-thin pr-1">
        {!isLoading && notifications.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-secondary px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary text-muted">
              <HistoryIcon />
            </div>
            <p className="text-body-sm text-heading! font-medium">Nothing here yet</p>
            <p className="text-caption mt-1">Project updates will collect here quietly.</p>
          </div>
        ) : (
          <div className="space-y-3">
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
    </Card>
  );
}
