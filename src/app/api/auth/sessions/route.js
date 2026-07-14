import { query } from "@/lib/db";
import { clearAuthCookie, getTokenFromRequest } from "@/lib/auth";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const currentToken = getTokenFromRequest(request);
    const result = await query(
      `SELECT id, device_info, ip_address, created_at, expires_at,
              COALESCE(token = $2, false) AS is_current
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [request.user.id, currentToken]
    );

    return apiResponse({ sessions: result.rows });
  } catch (error) {
    console.error("Sessions list error:", error);
    return apiError("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return apiError("Session ID is required");
    }

    // Only allow users to delete their own sessions
    const result = await query(
      "DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING token",
      [sessionId, request.user.id]
    );

    if (result.rows.length === 0) {
      return apiError("Session not found", 404);
    }

    if (result.rows[0].token === getTokenFromRequest(request)) {
      await clearAuthCookie();
    }

    return apiResponse({ message: "Session revoked" });
  } catch (error) {
    console.error("Session revoke error:", error);
    return apiError("Internal server error", 500);
  }
});
