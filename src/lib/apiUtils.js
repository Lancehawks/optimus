import { NextResponse } from "next/server";
import { getAuthUser } from "./auth";
import { logError } from "./logger";

export function apiResponse(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiNoStoreResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

export function apiError(message, status = 400) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    }
  );
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

// Admin routes answer 404 to everyone else, so they don't advertise themselves.
export function withAdmin(handler) {
  return withAuth(async (request, context) => {
    if (request.user.role !== "admin") return apiError("Not found", 404);
    return handler(request, context);
  });
}
