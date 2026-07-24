import { query } from "@/lib/db";
import { getTokenFromRequest, hashToken } from "@/lib/auth";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const currentToken = getTokenFromRequest(request);
    const result = await query(
      `SELECT id, device_info, ip_address, created_at, expires_at,
              COALESCE(token_hash = $2, false) AS is_current
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [request.user.id, currentToken ? hashToken(currentToken) : null]
    );

    return apiResponse({ sessions: result.rows });
  } catch (error) {
    console.error("Sessions list error:", error);
    return apiError("Internal server error", 500);
  }
});
