import { query, transaction } from "@/lib/db";
import { apiError, apiNoStoreResponse, withAuth } from "@/lib/apiUtils";
import { parseJsonObject } from "@/lib/apiValidation";
import { checkRateLimits } from "@/lib/rateLimit";
import { sendInvitationEmail } from "@/lib/email";
import {
  buildInvitationUrl,
  issueInvitation,
  normalizeInvitationEmail,
  serializeInvitation,
} from "@/lib/invitations";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT id, email, expires_at, accepted_at, revoked_at, created_at
       FROM workspace_invitations
       WHERE invited_by = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [request.user.id]
    );
    return apiNoStoreResponse({ invitations: result.rows.map(serializeInvitation) });
  } catch (error) {
    console.error("List invitations error:", error);
    return apiError("Internal server error", 500);
  }
});

export const POST = withAuth(async (request) => {
  try {
    const { data: body, error: bodyError } = await parseJsonObject(request);
    if (bodyError) return apiError(bodyError);

    const email = normalizeInvitationEmail(body.email);
    if (!email) return apiError("Enter a valid email address");

    const rateLimit = await checkRateLimits(request, [
      { scope: "invitations:create:user", identifier: request.user.id, limit: 20, windowMs: RATE_LIMIT_WINDOW_MS, perIp: false },
      { scope: "invitations:create:email", identifier: email, limit: 5, windowMs: RATE_LIMIT_WINDOW_MS, perIp: false },
    ]);
    if (!rateLimit.allowed) {
      return apiError("Too many invitations. Please try again later.", 429);
    }

    const issued = await transaction((client) => issueInvitation(client, { email, invitedBy: request.user.id }));
    if (issued.error === "already_member") {
      return apiError("That person already has an Optimus account", 409);
    }

    const inviteUrl = buildInvitationUrl(issued.token);
    let delivered = false;
    try {
      const delivery = await sendInvitationEmail({ email, inviteUrl, inviterName: request.user.full_name });
      delivered = delivery.delivered;
    } catch (deliveryError) {
      // The inviter still receives the link to share directly.
      console.error("Invitation delivery error:", deliveryError);
    }

    return apiNoStoreResponse({
      invitation: serializeInvitation(issued.invitation),
      inviteUrl,
      delivered,
    }, 201);
  } catch (error) {
    console.error("Create invitation error:", error);
    return apiError("Internal server error", 500);
  }
});
