import { founderBody } from "@/lib/founderValues";
import { getTokenFromRequest } from "@/lib/auth";
import {
  clearFounderAccess,
  getConfiguredFounderPin,
  grantFounderAccess,
} from "@/lib/founderAccess";
import { verifyFounderPin } from "@/lib/founderAccessToken";
import { checkRateLimits } from "@/lib/rateLimit";
import {
  apiError,
  apiNoStoreResponse,
  apiUnavailable,
  withAuth,
} from "@/lib/apiUtils";

const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const PIN_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

// A 4-digit PIN has only 10,000 values, so attempts are capped per account
// across all IPs and per network across all accounts, not just per account+IP.
const PIN_RATE_LIMITS = (userId) => [
  { scope: "founder:lobby:unlock", identifier: userId, limit: 5, windowMs: PIN_ATTEMPT_WINDOW_MS },
  { scope: "founder:lobby:unlock:account", identifier: userId, limit: 10, windowMs: PIN_ACCOUNT_WINDOW_MS, perIp: false },
  { scope: "founder:lobby:unlock:network", identifier: null, limit: 20, windowMs: PIN_ATTEMPT_WINDOW_MS },
];

export const POST = withAuth(async (request) => {
  let rateLimit;
  try {
    rateLimit = await checkRateLimits(request, PIN_RATE_LIMITS(request.user.id));
  } catch (error) {
    console.error("Founder Lobby rate limit error:", error);
    return apiUnavailable("Founder Lobby is temporarily unavailable");
  }

  if (!rateLimit.allowed) {
    return apiError("Too many PIN attempts. Please try again later.", 429);
  }

  let expectedPin;
  try {
    expectedPin = getConfiguredFounderPin();
  } catch (error) {
    console.error("Founder Lobby configuration error:", error);
    return apiUnavailable("Founder Lobby is temporarily unavailable");
  }

  const body = founderBody(await request.json().catch(() => null));
  if (!verifyFounderPin(body.pin, expectedPin)) {
    return apiError("That PIN is not correct.", 401);
  }

  const sessionToken = getTokenFromRequest(request);
  if (!sessionToken) return apiError("Unauthorized", 401);

  try {
    await grantFounderAccess(request.user.id, sessionToken);
  } catch (error) {
    console.error("Founder Lobby unlock error:", error);
    return apiUnavailable("Founder Lobby is temporarily unavailable");
  }

  return apiNoStoreResponse({ unlocked: true });
});

export const DELETE = withAuth(async () => {
  await clearFounderAccess();
  return apiNoStoreResponse({ unlocked: false });
});
