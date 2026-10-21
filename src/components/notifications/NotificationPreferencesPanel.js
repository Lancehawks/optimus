"use client";

import { Toggle } from "@/components/ui";

export default function NotificationPreferencesPanel({ preferences, savingPreference, onChange }) {
  return (
    <div className="mx-4 mb-3 divide-y divide-border rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-sm text-heading">Play a sound</span>
        <Toggle
          checked={preferences.soundEnabled}
          onChange={(checked) => onChange("soundEnabled", checked)}
          disabled={!!savingPreference}
          size="sm"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-sm text-heading">Mark as read when seen</span>
        <Toggle
          checked={preferences.markReadOnView}
          onChange={(checked) => onChange("markReadOnView", checked)}
          disabled={!!savingPreference}
          size="sm"
        />
      </div>
    </div>
  );
}
