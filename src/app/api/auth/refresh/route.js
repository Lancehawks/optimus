import { transaction } from "@/lib/db";
import { getBearerTokenFromRequest, isMobileApiRequest } from "@/lib/authRequest";
import { apiNoStoreResponse, apiError } from "@/lib/apiUtils";
import { rotateSessionToken } from "@/lib/mobileSession";

export async function POST(request) {
  if (!isMobileApiRequest(request)) {
    return apiError("Not found", 404);
  }

  const currentToken = getBearerTokenFromRequest(request);
  if (!currentToken) {
    return apiError("Unauthorized", 401);
  }

  try {
    const rotatedSession = await transaction((client) => rotateSessionToken(client, currentToken));

    if (!rotatedSession) {
      return apiError("Unauthorized", 401);
    }

    return apiNoStoreResponse(rotatedSession);
  } catch (error) {
    console.error("Mobile session refresh error:", error);
    return apiError("Internal server error", 500);
  }
}
