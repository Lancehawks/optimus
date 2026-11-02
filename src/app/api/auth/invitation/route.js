import { query } from "@/lib/db";
import { apiError, apiNoStoreResponse } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";
import { findPendingInvitation } from "@/lib/invitations";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Public preview of an invitation link: confirms it is usable and shows the
// address it was issued to. Unknown, used, revoked and expired links all
// return the same response.
export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";

    const rateLimit = await checkRateLimits(request, [
      { scope: "auth:invitation:ip", limit: 30, windowMs: RATE_LIMIT_WINDOW_MS },
    ]);
    if (!rateLimit.allowed) {
      return apiError("Too many attempts. Please try again later.", 429);
    }

    const invitation = await findPendingInvitation({ query }, token);
    if (!invitation) {
      return apiError("This invitation is invalid or has expired", 404);
    }

    return apiNoStoreResponse({
      invitation: {
        email: invitation.email,
        inviterName: invitation.inviter_name || null,
        expiresAt: new Date(invitation.expires_at).toISOString(),
      },
    });
  } catch (error) {
    console.error("Invitation preview error:", error);
    return apiError("Internal server error", 500);
  }
}
