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

export const POST = withAuth(async (request) => {
  const rateLimit = await checkRateLimits(request, [{
    scope: "founder:lobby:unlock",
    identifier: request.user.id,
    limit: 5,
    windowMs: PIN_ATTEMPT_WINDOW_MS,
  }]);

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
