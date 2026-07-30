import { isExpoPushToken } from "./pushDeviceValidation.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_SEND_LIMIT = 100;
const EXPO_RECEIPT_LIMIT = 1000;
const EXPO_REQUEST_TIMEOUT_MS = 10_000;

export class ExpoPushRequestError extends Error {
  constructor(status) {
    super(status ? `Expo push request failed with status ${status}` : "Expo push request failed");
    this.name = "ExpoPushRequestError";
    this.status = status || null;
  }
}

function expoHeaders() {
  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function postExpoJson(url, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(EXPO_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ExpoPushRequestError();
  }

  if (!response.ok) {
    throw new ExpoPushRequestError(response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new ExpoPushRequestError(response.status);
  }
}

export async function sendExpoPushMessages(messages, { fetchImpl = fetch } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  if (messages.length > EXPO_SEND_LIMIT) {
    throw new RangeError(`Expo push batches cannot exceed ${EXPO_SEND_LIMIT} messages`);
  }
  if (messages.some((message) => !isExpoPushToken(message?.to))) {
    throw new TypeError("Expo push batch contains an invalid destination");
  }

  const payload = await postExpoJson(EXPO_PUSH_URL, messages, fetchImpl);
  if (!Array.isArray(payload?.data) || payload.data.length !== messages.length) {
    throw new ExpoPushRequestError(200);
  }
  return payload.data;
}

export async function getExpoPushReceipts(ticketIds, { fetchImpl = fetch } = {}) {
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) return {};
  if (ticketIds.length > EXPO_RECEIPT_LIMIT) {
    throw new RangeError(`Expo receipt batches cannot exceed ${EXPO_RECEIPT_LIMIT} tickets`);
  }

  const payload = await postExpoJson(EXPO_RECEIPTS_URL, { ids: ticketIds }, fetchImpl);
  if (!payload?.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    throw new ExpoPushRequestError(200);
  }
  return payload.data;
}

function limitedText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function internalNotificationHref(value) {
  const href = limitedText(value, 500);
  return href.startsWith("/") && !href.startsWith("//") ? href : null;
}

export function buildExpoPushMessage(delivery, { soundEnabled = true } = {}) {
  const data = {
    notificationId: String(delivery.notification_id),
    type: String(delivery.type),
  };
  if (delivery.entity_type) data.entityType = String(delivery.entity_type);
  if (delivery.entity_id) data.entityId = String(delivery.entity_id);
  const href = internalNotificationHref(delivery.metadata?.href);
  if (href) data.href = href;

  return {
    to: delivery.expo_push_token,
    // Lock-screen text must remain safe even if a platform has not yet
    // observed a just-revoked session. Full content is fetched after unlock
    // through the authenticated notifications API.
    title: "Optimus",
    body: "You have a new update. Open Optimus to view it.",
    data,
    ttl: 60 * 60,
    ...(soundEnabled ? { sound: "default" } : {}),
  };
}

export function expoTicketErrorCode(ticket) {
  return typeof ticket?.details?.error === "string"
    ? ticket.details.error.slice(0, 120)
    : "ExpoPushError";
}
