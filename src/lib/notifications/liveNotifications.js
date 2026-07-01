import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";
import {
  listEventCompletionCandidates,
  listEventReminderCandidates,
  listTaskReminderCandidates,
} from "@/lib/notifications/live/candidates";
import {
  buildEventCompletionNotification,
  buildEventLiveNotification,
  buildTaskLiveNotification,
} from "@/lib/notifications/live/builders";
import {
  insertEventCompletionNotification,
  insertLiveNotification,
} from "@/lib/notifications/live/inserts";

function getReminderWindow(now, leadMinutes) {
  return {
    windowStart: new Date(now.getTime() - 5 * 60 * 1000),
    windowEnd: new Date(now.getTime() + leadMinutes * 60 * 1000),
  };
}

async function countInsertedLiveNotifications(userId, notifications) {
  let createdCount = 0;

  for (const notification of notifications) {
    const inserted = await insertLiveNotification(userId, notification);
    if (inserted) createdCount++;
  }

  return createdCount;
}

async function countInsertedCompletionNotifications(notifications) {
  let createdCount = 0;

  for (const notification of notifications) {
    const inserted = await insertEventCompletionNotification(notification);
    if (inserted) createdCount++;
  }

  return createdCount;
}

export async function syncLiveNotifications(userId, preferences) {
  if (!userId) return 0;

  const prefs = normalizeNotificationPreferences(preferences);
  if (!prefs.taskReminders && !prefs.eventReminders) return 0;

  const now = new Date();
  const { windowStart, windowEnd } = getReminderWindow(now, prefs.reminderLeadMinutes);

  try {
    const [tasks, events, completionCandidates] = await Promise.all([
      prefs.taskReminders
        ? listTaskReminderCandidates({ userId, windowEnd })
        : Promise.resolve([]),
      prefs.eventReminders
        ? listEventReminderCandidates({ userId, windowStart, windowEnd, now })
        : Promise.resolve([]),
      prefs.eventReminders
        ? listEventCompletionCandidates(userId, now)
        : Promise.resolve([]),
    ]);

    const liveNotifications = [
      ...events.map((event) => buildEventLiveNotification(event, now)),
      ...tasks.map(buildTaskLiveNotification),
    ];
    const completionNotifications = completionCandidates.map(buildEventCompletionNotification);

    const [liveCount, completionCount] = await Promise.all([
      countInsertedLiveNotifications(userId, liveNotifications),
      countInsertedCompletionNotifications(completionNotifications),
    ]);

    return liveCount + completionCount;
  } catch (error) {
    if (error.code === "42P01") return 0;
    throw error;
  }
}
