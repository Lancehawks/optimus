export const REMINDER_LEAD_MINUTE_OPTIONS = [5, 10, 15, 30, 60];

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  projectActivity: true,
  taskReminders: true,
  eventReminders: true,
  soundEnabled: true,
  markReadOnView: true,
  reminderLeadMinutes: 10,
};

export function normalizeNotificationPreferences(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const leadMinutes = Number(source.reminderLeadMinutes);

  return {
    projectActivity: source.projectActivity !== false,
    taskReminders: source.taskReminders !== false,
    eventReminders: source.eventReminders !== false,
    soundEnabled: source.soundEnabled !== false,
    markReadOnView: source.markReadOnView !== false,
    reminderLeadMinutes: REMINDER_LEAD_MINUTE_OPTIONS.includes(leadMinutes)
      ? leadMinutes
      : DEFAULT_NOTIFICATION_PREFERENCES.reminderLeadMinutes,
  };
}
