// Browser client for the Founder Lobby API. Founder data is shared by every
// founder and stays isolated from the regular Optimus workspace APIs.

export const FOUNDER_ENDPOINTS = Object.freeze({
  unlock: "/api/founder/unlock",
  countdown: "/api/founder/countdown",
  settings: "/api/founder/settings",
  milestones: "/api/founder/milestones",
  targets: "/api/founder/targets",
  leads: "/api/founder/leads",
  notes: "/api/founder/notes",
});

// Founder access is a 4-hour, session-bound grant. Any 403 from a founder
// route means it lapsed, so the lobby listens for this and returns to the PIN
// gate instead of leaving every station stuck on "Founder Lobby is locked".
export const FOUNDER_LOCKED_EVENT = "founder:locked";
// Dispatched after every successful write, with the endpoint as `detail`, so
// derived views (the sales overview) can refresh.
export const FOUNDER_DATA_CHANGED_EVENT = "founder:data-changed";

/**
 * JSON request to a founder endpoint. Rejects with an Error carrying the API's
 * message and HTTP `status` (absent for network failures).
 * @param {string} url
 * @param {{ method?: string, body?: unknown, fallbackError?: string }} [options]
 */
export async function requestFounderJson(url, { method = "GET", body, fallbackError = "The room could not be updated." } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      cache: "no-store",
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
  } catch {
    throw new Error("Check your connection and try again.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403) window.dispatchEvent(new Event(FOUNDER_LOCKED_EVENT));
    throw Object.assign(new Error(result.error || fallbackError), { status: response.status });
  }

  if (method !== "GET") {
    window.dispatchEvent(new CustomEvent(FOUNDER_DATA_CHANGED_EVENT, { detail: url.split("?")[0] }));
  }
  return result;
}
