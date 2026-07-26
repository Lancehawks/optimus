import { clearAuthCookie } from "@/lib/auth";
import {
  apiError,
  apiNoStoreResponse,
  withAuth,
} from "@/lib/apiUtils";
import { permanentlyDeleteAccount } from "@/lib/accountDeletion";
import { validateAccountDeletionInput } from "@/lib/accountDeletionValidation";
import { isMobileApiRequest } from "@/lib/authRequest";
import { checkRateLimits } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

const ACCOUNT_DELETION_WINDOW_MS = 60 * 60 * 1000;

export const DELETE = withAuth(async (request) => {
  const input = validateAccountDeletionInput(
    await request.json().catch(() => null)
  );
  if (input.error) return apiError(input.error);

  try {
    const rateLimit = await checkRateLimits(request, [
      {
        scope: "auth:account-delete:ip",
        limit: 5,
        windowMs: ACCOUNT_DELETION_WINDOW_MS,
      },
      {
        scope: "auth:account-delete:user",
        identifier: request.user.id,
        limit: 3,
        windowMs: ACCOUNT_DELETION_WINDOW_MS,
      },
    ]);
    if (!rateLimit.allowed) {
      return apiError(
        "Too many account deletion attempts. Please try again later.",
        429
      );
    }

    const result = await permanentlyDeleteAccount(
      request.user.id,
      input.value.currentPassword
    );
    if (!result.deleted) {
      return apiError(
        result.reason === "password"
          ? "Current password is incorrect"
          : "Account is unavailable",
        result.reason === "password" ? 403 : 409
      );
    }

    if (!isMobileApiRequest(request)) {
      try {
        await clearAuthCookie();
      } catch (error) {
        // The account and every server-side session are already gone. A stale
        // browser cookie is unusable, so cookie cleanup must not turn a
        // committed deletion into a misleading failure response.
        logError("auth.account_deletion_cookie_cleanup_failed", error);
      }
    }
    return apiNoStoreResponse({
      message: "Account deleted successfully",
    });
  } catch (error) {
    logError("auth.account_deletion_failed", error, {
      userId: request.user.id,
    });
    return apiError("Account deletion could not be completed", 500);
  }
});
