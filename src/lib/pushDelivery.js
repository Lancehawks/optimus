import crypto from "node:crypto";
import { query, transaction } from "@/lib/db";
import { notificationPreferenceSqlClause } from "@/lib/notifications/notificationSql";
import {
  ExpoPushRequestError,
  buildExpoPushMessage,
  expoTicketErrorCode,
  getExpoPushReceipts,
  sendExpoPushMessages,
} from "@/lib/expoPushClient";
import { decryptSecret, isEncryptedSecret } from "@/lib/secretEncryption";

const RECEIPT_MAX_ATTEMPTS = 5;
const RETRYABLE_TICKET_ERRORS = new Set([
  "ExpoPushError",
  "InvalidCredentials",
  "MessageRateExceeded",
]);

function batchLimit(name, fallback, maximum) {
  return Math.min(Math.max(Number(process.env[name]) || fallback, 1), maximum);
}

function safeErrorCode(error) {
  if (error instanceof ExpoPushRequestError) {
    return error.status ? `ExpoHttp${error.status}` : "ExpoTransportError";
  }
  return "ExpoTransportError";
}

async function seedPushDeliveries(userId, preferences) {
  const preferenceClause = notificationPreferenceSqlClause("n", preferences);
  const result = await query(
    `INSERT INTO push_notification_deliveries
       (notification_id, user_id, push_device_id, device_id)
     SELECT n.id, n.user_id, d.id, d.device_id
     FROM notifications n
     JOIN push_devices d ON d.user_id = n.user_id
     JOIN sessions auth_session
       ON auth_session.id = d.session_id
      AND auth_session.user_id = d.user_id
      AND auth_session.expires_at > NOW()
     WHERE n.user_id = $1
       AND n.read_at IS NULL
       AND n.created_at >= d.created_at
       AND n.created_at > NOW() - INTERVAL '24 hours'
       ${preferenceClause}
     ON CONFLICT (notification_id, user_id, device_id) DO NOTHING
     RETURNING id`,
    [userId]
  );
  return result.rows.length;
}

async function cancelUndeliverablePushes(userId) {
  const result = await query(
    `UPDATE push_notification_deliveries delivery
     SET status = 'cancelled',
         locked_at = NULL,
         locked_by = NULL,
         last_error = 'Notification read or device unavailable',
         updated_at = NOW()
     WHERE delivery.user_id = $1
       AND delivery.status IN ('pending', 'processing', 'retry')
       AND (
         delivery.push_device_id IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM push_devices device
           JOIN sessions auth_session
             ON auth_session.id = device.session_id
            AND auth_session.user_id = device.user_id
            AND auth_session.expires_at > NOW()
           WHERE device.id = delivery.push_device_id
             AND device.user_id = delivery.user_id
         )
         OR NOT EXISTS (
           SELECT 1
           FROM notifications notification
           WHERE notification.id = delivery.notification_id
             AND notification.user_id = delivery.user_id
             AND notification.read_at IS NULL
         )
       )
     RETURNING delivery.id`,
    [userId]
  );
  return result.rows.length;
}

async function claimPushDeliveries(userId, workerId, limit) {
  return transaction(async (client) => {
    const claimed = await client.query(
      `WITH claimable AS (
         SELECT delivery.id
         FROM push_notification_deliveries delivery
         JOIN push_devices device ON device.id = delivery.push_device_id
         JOIN sessions auth_session
           ON auth_session.id = device.session_id
          AND auth_session.user_id = device.user_id
          AND auth_session.expires_at > NOW()
         JOIN notifications notification
           ON notification.id = delivery.notification_id
          AND notification.user_id = delivery.user_id
         WHERE delivery.user_id = $1
           AND notification.read_at IS NULL
           AND delivery.attempts < delivery.max_attempts
           AND (
             (delivery.status IN ('pending', 'retry') AND delivery.available_at <= NOW())
             OR (
               delivery.status = 'processing'
               AND delivery.locked_at < NOW() - INTERVAL '15 minutes'
             )
           )
         ORDER BY delivery.available_at, delivery.created_at
         FOR UPDATE OF delivery SKIP LOCKED
         LIMIT $2
       )
       UPDATE push_notification_deliveries delivery
       SET status = 'processing',
           attempts = delivery.attempts + 1,
           locked_at = NOW(),
           locked_by = $3,
           updated_at = NOW()
       FROM claimable
       WHERE delivery.id = claimable.id
       RETURNING delivery.id`,
      [userId, limit, workerId]
    );
    if (claimed.rows.length === 0) return [];

    const result = await client.query(
      `SELECT
         delivery.id,
         delivery.notification_id,
         delivery.push_device_id,
         delivery.device_id,
         delivery.attempts,
         delivery.max_attempts,
         device.token_ciphertext,
         device.platform,
         notification.type,
         notification.title,
         notification.body,
         notification.entity_type,
         notification.entity_id,
         notification.metadata
       FROM push_notification_deliveries delivery
       JOIN push_devices device ON device.id = delivery.push_device_id
       JOIN sessions auth_session
         ON auth_session.id = device.session_id
        AND auth_session.user_id = device.user_id
        AND auth_session.expires_at > NOW()
       JOIN notifications notification ON notification.id = delivery.notification_id
       WHERE delivery.id = ANY($1::uuid[])
       ORDER BY delivery.created_at`,
      [claimed.rows.map((row) => row.id)]
    );
    return result.rows;
  });
}

async function releasePushClaims(deliveries, errorCode) {
  if (deliveries.length === 0) return;
  await query(
    `UPDATE push_notification_deliveries
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'retry' END,
         available_at = CASE WHEN attempts >= max_attempts
           THEN available_at
           ELSE NOW() + (
             LEAST(30 * POWER(2, GREATEST(attempts - 1, 0)), 3600)
             * INTERVAL '1 second'
           )
         END,
         locked_at = NULL,
         locked_by = NULL,
         last_error = $2,
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])
       AND status = 'processing'`,
    [deliveries.map((delivery) => delivery.id), errorCode]
  );
}

async function disableUnregisteredDevice(client, delivery) {
  if (!delivery.push_device_id) return;
  await client.query(
    `UPDATE push_notification_deliveries
     SET status = 'cancelled',
         last_error = 'DeviceNotRegistered',
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()
     WHERE push_device_id = $1
       AND id <> $2
       AND status IN ('pending', 'retry')`,
    [delivery.push_device_id, delivery.id]
  );
  await client.query(
    "DELETE FROM push_devices WHERE id = $1 AND user_id = $2",
    [delivery.push_device_id, delivery.user_id]
  );
}

async function applyExpoTickets(userId, deliveries, tickets) {
  return transaction(async (client) => {
    const summary = { accepted: 0, retried: 0, failed: 0 };

    for (let index = 0; index < deliveries.length; index++) {
      const delivery = { ...deliveries[index], user_id: userId };
      const ticket = tickets[index];

      if (ticket?.status === "ok" && typeof ticket.id === "string" && ticket.id) {
        await client.query(
          `UPDATE push_notification_deliveries
           SET status = 'accepted',
               expo_ticket_id = $2,
               receipt_available_at = NOW() + INTERVAL '15 minutes',
               locked_at = NULL,
               locked_by = NULL,
               last_error = NULL,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $3 AND status = 'processing'`,
          [delivery.id, ticket.id, userId]
        );
        summary.accepted += 1;
        continue;
      }

      const errorCode = expoTicketErrorCode(ticket);
      const canRetry = RETRYABLE_TICKET_ERRORS.has(errorCode)
        && Number(delivery.attempts) < Number(delivery.max_attempts);
      await client.query(
        `UPDATE push_notification_deliveries
         SET status = $2,
             available_at = CASE WHEN $2 = 'retry'
               THEN NOW() + (
                 LEAST(30 * POWER(2, GREATEST(attempts - 1, 0)), 3600)
                 * INTERVAL '1 second'
               )
               ELSE available_at
             END,
             locked_at = NULL,
             locked_by = NULL,
             last_error = $3,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $4 AND status = 'processing'`,
        [delivery.id, canRetry ? "retry" : "failed", errorCode, userId]
      );

      if (errorCode === "DeviceNotRegistered") {
        await disableUnregisteredDevice(client, delivery);
      }
      if (canRetry) summary.retried += 1;
      else summary.failed += 1;
    }

    return summary;
  });
}

async function claimPushReceipts(userId, workerId, limit) {
  return transaction(async (client) => {
    const result = await client.query(
      `WITH claimable AS (
         SELECT id
         FROM push_notification_deliveries
         WHERE user_id = $1
           AND status = 'accepted'
           AND expo_ticket_id IS NOT NULL
           AND receipt_available_at <= NOW()
           AND receipt_attempts < $3
           AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '15 minutes')
         ORDER BY receipt_available_at, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE push_notification_deliveries delivery
       SET receipt_attempts = delivery.receipt_attempts + 1,
           locked_at = NOW(),
           locked_by = $4,
           updated_at = NOW()
       FROM claimable
       WHERE delivery.id = claimable.id
       RETURNING delivery.id, delivery.expo_ticket_id, delivery.push_device_id,
                 delivery.receipt_attempts, delivery.device_id`,
      [userId, limit, RECEIPT_MAX_ATTEMPTS, workerId]
    );
    return result.rows;
  });
}

async function releaseReceiptClaims(userId, deliveries, errorCode) {
  if (deliveries.length === 0) return;
  await query(
    `UPDATE push_notification_deliveries
     SET status = CASE WHEN receipt_attempts >= $4 THEN 'failed' ELSE 'accepted' END,
         receipt_available_at = CASE WHEN receipt_attempts >= $4
           THEN receipt_available_at
           ELSE NOW() + (
             LEAST(60 * POWER(2, GREATEST(receipt_attempts - 1, 0)), 3600)
             * INTERVAL '1 second'
           )
         END,
         locked_at = NULL,
         locked_by = NULL,
         last_error = $3,
         updated_at = NOW()
     WHERE user_id = $1
       AND id = ANY($2::uuid[])
       AND status = 'accepted'`,
    [
      userId,
      deliveries.map((delivery) => delivery.id),
      errorCode,
      RECEIPT_MAX_ATTEMPTS,
    ]
  );
}

async function applyExpoReceipts(userId, deliveries, receipts) {
  return transaction(async (client) => {
    const summary = { delivered: 0, pending: 0, failed: 0 };

    for (const receiptDelivery of deliveries) {
      const receipt = receipts[receiptDelivery.expo_ticket_id];
      const delivery = { ...receiptDelivery, user_id: userId };

      if (receipt?.status === "ok") {
        await client.query(
          `UPDATE push_notification_deliveries
           SET status = 'delivered',
               delivered_at = NOW(),
               locked_at = NULL,
               locked_by = NULL,
               last_error = NULL,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2 AND status = 'accepted'`,
          [delivery.id, userId]
        );
        summary.delivered += 1;
        continue;
      }

      if (!receipt) {
        const exhausted = Number(delivery.receipt_attempts) >= RECEIPT_MAX_ATTEMPTS;
        await client.query(
          `UPDATE push_notification_deliveries
           SET status = $2,
               receipt_available_at = CASE WHEN $2 = 'accepted'
                 THEN NOW() + (
                   LEAST(60 * POWER(2, GREATEST(receipt_attempts - 1, 0)), 3600)
                   * INTERVAL '1 second'
                 )
                 ELSE receipt_available_at
               END,
               locked_at = NULL,
               locked_by = NULL,
               last_error = 'ExpoReceiptUnavailable',
               updated_at = NOW()
           WHERE id = $1 AND user_id = $3 AND status = 'accepted'`,
          [delivery.id, exhausted ? "failed" : "accepted", userId]
        );
        if (exhausted) summary.failed += 1;
        else summary.pending += 1;
        continue;
      }

      const errorCode = expoTicketErrorCode(receipt);
      await client.query(
        `UPDATE push_notification_deliveries
         SET status = 'failed',
             locked_at = NULL,
             locked_by = NULL,
             last_error = $2,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $3 AND status = 'accepted'`,
        [delivery.id, errorCode, userId]
      );
      if (errorCode === "DeviceNotRegistered") {
        await disableUnregisteredDevice(client, delivery);
      }
      summary.failed += 1;
    }

    return summary;
  });
}

export async function dispatchExpoPushNotifications(
  userId,
  preferences,
  { fetchImpl = fetch } = {}
) {
  if (process.env.EXPO_PUSH_ENABLED === "false") {
    return { disabled: true, seeded: 0, claimed: 0, accepted: 0, delivered: 0 };
  }

  const workerId = `expo-push-${crypto.randomUUID()}`;
  const receiptLimit = batchLimit("EXPO_PUSH_RECEIPT_BATCH", 100, 1000);
  const sendLimit = batchLimit("EXPO_PUSH_BATCH", 50, 100);
  const receiptDeliveries = await claimPushReceipts(userId, workerId, receiptLimit);
  let receiptSummary = { delivered: 0, pending: 0, failed: 0 };

  if (receiptDeliveries.length > 0) {
    try {
      const receipts = await getExpoPushReceipts(
        receiptDeliveries.map((delivery) => delivery.expo_ticket_id),
        { fetchImpl }
      );
      receiptSummary = await applyExpoReceipts(userId, receiptDeliveries, receipts);
    } catch (error) {
      await releaseReceiptClaims(userId, receiptDeliveries, safeErrorCode(error));
      throw error;
    }
  }

  const seeded = await seedPushDeliveries(userId, preferences);
  const cancelled = await cancelUndeliverablePushes(userId);
  const deliveries = await claimPushDeliveries(userId, workerId, sendLimit);
  if (deliveries.length === 0) {
    return {
      disabled: false,
      seeded,
      cancelled,
      claimed: 0,
      accepted: 0,
      retried: 0,
      failed: receiptSummary.failed,
      delivered: receiptSummary.delivered,
      receiptsPending: receiptSummary.pending,
    };
  }

  let messages;
  let tickets;
  try {
    messages = deliveries.map((delivery) => {
      if (!isEncryptedSecret(delivery.token_ciphertext)) {
        throw new Error("Push device token requires encrypted storage");
      }
      return buildExpoPushMessage({
        ...delivery,
        expo_push_token: decryptSecret(delivery.token_ciphertext),
      }, preferences);
    });
    tickets = await sendExpoPushMessages(messages, { fetchImpl });
  } catch (error) {
    await releasePushClaims(deliveries, safeErrorCode(error));
    throw error;
  }

  const ticketSummary = await applyExpoTickets(userId, deliveries, tickets);
  return {
    disabled: false,
    seeded,
    cancelled,
    claimed: deliveries.length,
    ...ticketSummary,
    failed: ticketSummary.failed + receiptSummary.failed,
    delivered: receiptSummary.delivered,
    receiptsPending: receiptSummary.pending,
  };
}
