"use client";

import { Toggle } from "@/components/ui";

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
      </div>
      {savingPreference && (
        <p className="text-caption mt-3">Saving preference...</p>
      )}
    </div>
  );
}
