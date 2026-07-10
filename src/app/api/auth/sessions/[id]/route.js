import { query } from "@/lib/db";
import { clearAuthCookie, getTokenFromRequest } from "@/lib/auth";
import { withAuth, apiResponse, apiError } from "@/lib/apiUtils";

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;

    if (!id) {
      return apiError("Session ID is required");
    }

    const result = await query(
      "DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING token",
      [id, request.user.id]
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
