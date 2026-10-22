import { NextResponse } from "next/server";

const protectedPaths = [
  "/dashboard", "/tasks", "/notes", "/settings", "/calendar", "/projects",
  "/routines", "/library", "/whiteboards", "/founder", "/admin",
];

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("optimus_token")?.value;
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const redirect = (url) => {
    const response = NextResponse.redirect(url);
    response.headers.set("x-request-id", requestId);
    return response;
  };

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  if (isProtected && !token) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return redirect(loginUrl);
  }

  // The sign-in page at "/" validates the session on the server and forwards
  // signed-in members, so a stale cookie can never bounce between two routes.

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
