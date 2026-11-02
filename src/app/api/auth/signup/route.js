import { transaction } from "@/lib/db";
import { hashPassword, createSession, setAuthCookie } from "@/lib/auth";
import {
  getMobileSessionCredentials,
  isMobileApiRequest,
} from "@/lib/authRequest";
import { apiNoStoreResponse, apiError } from "@/lib/apiUtils";
import { checkRateLimits } from "@/lib/rateLimit";
import { toSessionUser, userRecordSql } from "@/lib/userRecord";
import {
  isWellFormedInvitationToken,
  lockPendingInvitation,
  markInvitationAccepted,
} from "@/lib/invitations";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const INVALID_INVITATION = "This invitation is invalid or has expired";

// Optimus is invite-only: an account can be created only by redeeming a
// pending invitation. The email comes from the invitation, never the client.
export async function POST(request) {
  try {
    const { token, password, fullName } = await request.json().catch(() => ({}));
    const normalizedFullName = typeof fullName === "string" ? fullName.trim() : "";

    if (!isWellFormedInvitationToken(token)) {
      return apiError("An invitation is required to create an account", 403);
    }
    if (typeof password !== "string" || !normalizedFullName) {
      return apiError("Full name and password are required");
    }
    if (normalizedFullName.length > 150) return apiError("Full name must be 150 characters or less");

    const rateLimit = await checkRateLimits(request, [
      { scope: "auth:signup:ip", limit: 10, windowMs: RATE_LIMIT_WINDOW_MS },
      { scope: "auth:signup:invitation", identifier: token, limit: 5, windowMs: RATE_LIMIT_WINDOW_MS, perIp: false },
    ]);

    if (!rateLimit.allowed) {
      return apiError("Too many signup attempts. Please try again later.", 429);
    }

    if (password.length < 8) {
      return apiError("Password must be at least 8 characters");
    }
    if (password.length > 128) return apiError("Password must be 128 characters or less");

    const passwordHash = await hashPassword(password);
    const created = await transaction(async (client) => {
      const invitation = await lockPendingInvitation(client, token);
      if (!invitation) return { error: INVALID_INVITATION, status: 403 };

      const existing = await client.query("SELECT id FROM users WHERE email = $1", [invitation.email]);
      if (existing.rows.length > 0) {
        return { error: "An account with this email already exists", status: 409 };
      }

      const result = await client.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING ${userRecordSql("users")}`,
        [invitation.email, passwordHash, normalizedFullName]
      );
      const createdUser = toSessionUser(result.rows[0].account);
      await markInvitationAccepted(client, invitation.id, createdUser.id);
      const createdSession = await createSession(createdUser, request, client);
      return { user: createdUser, session: createdSession };
    });

    if (created.error) return apiError(created.error, created.status);
    const { user, session } = created;

    if (!isMobileApiRequest(request)) {
      await setAuthCookie(session.token);
    }

    return apiNoStoreResponse({
      user,
      ...getMobileSessionCredentials(request, session),
    }, 201);
  } catch (error) {
    if (error.code === "23505") {
      return apiError("An account with this email already exists", 409);
    }

    console.error("Signup error:", error);
    return apiError("Internal server error", 500);
  }
}
