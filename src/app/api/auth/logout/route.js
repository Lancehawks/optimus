import { query } from "@/lib/db";
import { clearAuthCookie, getTokenFromRequest, hashToken } from "@/lib/auth";
import { apiResponse, apiError } from "@/lib/apiUtils";

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    if (token) {
      await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    }

    await clearAuthCookie();
    return apiResponse({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return apiError("Internal server error", 500);
  }
}
