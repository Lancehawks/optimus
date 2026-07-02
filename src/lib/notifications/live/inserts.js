import { query } from "@/lib/db";

async function insertNotificationWithMetadataDedupe({
  userId,
  notification,
  metadataKey,
  metadataValue,
}) {
  if (!userId || !metadataValue) return null;

  const metadataKeySql = metadataKey === "completion_key" ? "completion_key" : "live_key";
  const result = await query(
    `INSERT INTO notifications
       (user_id, actor_user_id, project_id, activity_id, type, entity_type, entity_id, title, body, metadata)
     SELECT $1, NULL, $2, NULL, $3, $4, $5, $6, $7, $8::jsonb
     WHERE NOT EXISTS (
       SELECT 1
       FROM notifications
       WHERE user_id = $1
         AND type = $3
         AND metadata->>'${metadataKeySql}' = $9
     )
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      userId,
      notification.projectId || null,
      notification.type,
      notification.entityType,
      notification.entityId,
      notification.title,
      notification.body,
      JSON.stringify(notification.metadata || {}),
      metadataValue,
    ]
  );

  return result.rows[0] || null;
}

export async function insertLiveNotification(userId, notification) {
  return insertNotificationWithMetadataDedupe({
    userId,
    notification,
    metadataKey: "live_key",
    metadataValue: notification.metadata?.live_key,
  });
}

export async function insertEventCompletionNotification(notification) {
  return insertNotificationWithMetadataDedupe({
    userId: notification.userId,
    notification,
    metadataKey: "completion_key",
    metadataValue: notification.metadata?.completion_key,
  });
}
