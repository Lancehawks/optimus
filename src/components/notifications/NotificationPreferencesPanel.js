"use client";

import { Select, Toggle } from "@/components/ui";
import { REMINDER_LEAD_MINUTE_OPTIONS } from "@/lib/notificationPreferences";

export default function NotificationPreferencesPanel({
  preferences,
  savingPreference,
  onChange,
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-surface-secondary p-3">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-heading! font-medium">Project activity</span>
          <Toggle
            checked={preferences.projectActivity}
            onChange={(checked) => onChange("projectActivity", checked)}
            disabled={!!savingPreference}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-heading! font-medium">Task reminders</span>
          <Toggle
            checked={preferences.taskReminders}
            onChange={(checked) => onChange("taskReminders", checked)}
            disabled={!!savingPreference}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-heading! font-medium">Event reminders</span>
          <Toggle
            checked={preferences.eventReminders}
            onChange={(checked) => onChange("eventReminders", checked)}
            disabled={!!savingPreference}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-heading! font-medium">Notification sound</span>
          <Toggle
            checked={preferences.soundEnabled}
            onChange={(checked) => onChange("soundEnabled", checked)}
            disabled={!!savingPreference}
            size="sm"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-heading! font-medium">Auto-read on view</span>
          <Toggle
            checked={preferences.markReadOnView}
            onChange={(checked) => onChange("markReadOnView", checked)}
            disabled={!!savingPreference}
            size="sm"
          />
        </div>
        <Select
          label="Reminder lead time"
          value={String(preferences.reminderLeadMinutes)}
          onChange={(event) => onChange("reminderLeadMinutes", Number(event.target.value))}
          disabled={!!savingPreference}
          options={REMINDER_LEAD_MINUTE_OPTIONS.map((minutes) => ({
            value: String(minutes),
            label: `${minutes} minutes`,
          }))}
        />
      </div>
      {savingPreference && (
        <p className="text-caption mt-3">Saving preference...</p>
      )}
    </div>
  );
}
