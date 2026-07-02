import { query } from "@/lib/db";
import { normalizeNotificationPreferences } from "@/lib/notificationPreferences";

export async function getNotificationPreferences(userId) {
  if (!userId) return normalizeNotificationPreferences();

  const result = await query(
    "SELECT preferences FROM users WHERE id = $1",
    [userId]
  );

  return normalizeNotificationPreferences(
    result.rows[0]?.preferences?.notificationPreferences
  );
}

export async function updateNotificationPreferences(userId, preferences) {
  const normalized = normalizeNotificationPreferences(preferences);

  const result = await query(
    `UPDATE users
     SET preferences = jsonb_set(
       COALESCE(preferences, '{}'::jsonb),
       '{notificationPreferences}',
       $2::jsonb,
       true
     )
     WHERE id = $1
     RETURNING preferences`,
    [userId, JSON.stringify(normalized)]
  );

  return normalizeNotificationPreferences(
    result.rows[0]?.preferences?.notificationPreferences
  );
}
