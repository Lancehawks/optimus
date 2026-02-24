import { NextResponse } from "next/server";
import { getAuthUser } from "./auth";

export function apiResponse(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function withAuth(handler) {
  return async (request, context) => {
    const user = await getAuthUser(request);
    if (!user) {
      return apiError("Unauthorized", 401);
    }
    request.user = user;
    return handler(request, context);
  };
}
