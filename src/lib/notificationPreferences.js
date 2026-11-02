export const DEFAULT_NOTIFICATION_PREFERENCES = {
  soundEnabled: true,
  markReadOnView: true,
};

export function normalizeNotificationPreferences(value = {}) {
  const source = value && typeof value === "object" ? value : {};

  return {
    soundEnabled: source.soundEnabled !== false,
    markReadOnView: source.markReadOnView !== false,
  };
}
