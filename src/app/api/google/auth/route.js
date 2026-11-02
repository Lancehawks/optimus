import { withAuth, apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import {
  getBearerTokenFromRequest,
  isMobileApiRequest,
} from "@/lib/authRequest";
import { getTokenFromRequest } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google";
import { createGoogleOAuthFlow } from "@/lib/googleOAuthFlow";
import { validateMobileGoogleOAuthReturnUrl } from "@/lib/googleOAuthPrimitives";
import { validateMobileAppLinkOrigin } from "@/lib/mobileAppLinks";
import { logError } from "@/lib/logger";

export const GET = withAuth(async (request) => {
  const mobile = isMobileApiRequest(request);
  const sessionToken = mobile
    ? getBearerTokenFromRequest(request)
    : getTokenFromRequest(request);
  if (!sessionToken) return apiError("Unauthorized", 401);
  if (
    mobile
    && (
      !validateMobileGoogleOAuthReturnUrl()
      || !validateMobileAppLinkOrigin()
    )
  ) {
    return apiError("Mobile Google OAuth is not configured", 503);
  }

  try {
    const flow = await createGoogleOAuthFlow(
      request.user.id,
      mobile ? "mobile" : "web",
      sessionToken
    );
    if (!flow) return apiError("Unauthorized", 401);

    const url = getAuthUrl(flow);
    return apiNoStoreResponse({
      url,
      ...(mobile ? { expiresAt: flow.expiresAt } : {}),
    });
  } catch (error) {
    logError("google_oauth.start_failed", error, {
      userId: request.user.id,
      clientType: mobile ? "mobile" : "web",
    });
    return apiError("Google OAuth could not be started", 500);
  }
});
