import { query } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/auth";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const GET = withAuth(async (request) => {
  try {
    const result = await query(
      `SELECT id, device_info, ip_address, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [request.user.id]
    );

    const currentToken = getTokenFromRequest(request);
    const sessions = result.rows.map((session) => ({
      ...session,
      is_current: false, // We'll mark below
    }));

    // Mark the current session
    if (currentToken) {
      const currentSession = await query(
        "SELECT id FROM sessions WHERE token = $1",
        [currentToken]
      );
      if (currentSession.rows[0]) {
        const currentId = currentSession.rows[0].id;
        sessions.forEach((s) => {
          if (s.id === currentId) s.is_current = true;
        });
      }
    }

    return apiResponse({ sessions });
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
    await query(
      "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
      [sessionId, request.user.id]
    );

    return apiResponse({ message: "Session revoked" });
  } catch (error) {
    console.error("Session revoke error:", error);
    return apiError("Internal server error", 500);
  }
});
