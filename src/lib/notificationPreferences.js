export const DEFAULT_NOTIFICATION_PREFERENCES = {
  projectActivity: true,
  soundEnabled: true,
  markReadOnView: true,
};

export function normalizeNotificationPreferences(value = {}) {
  const source = value && typeof value === "object" ? value : {};

  return {
    projectActivity: source.projectActivity !== false,
    soundEnabled: source.soundEnabled !== false,
    markReadOnView: source.markReadOnView !== false,
  };
}
