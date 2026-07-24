import { NextResponse } from "next/server";
import { getAuthUser } from "./auth";
import { logError } from "./logger";

export function apiResponse(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiUnavailable(message = "Service temporarily unavailable") {
  return NextResponse.json(
    { error: message, retryable: true },
    { status: 503, headers: { "Retry-After": "5", "Cache-Control": "no-store" } }
  );
}

export function withAuth(handler) {
  return async (request, context) => {
    let user;
    try {
      user = await getAuthUser(request);
    } catch (error) {
      logError("auth.dependency_error", error, {
        requestId: request.headers.get("x-request-id") || null,
      });
      return apiUnavailable();
    }
    if (!user) {
      return apiError("Unauthorized", 401);
    }
    request.user = user;
    return handler(request, context);
  };
}
