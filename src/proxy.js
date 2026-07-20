import { NextResponse } from "next/server";

const protectedPaths = [
  "/dashboard", "/tasks", "/notes", "/settings", "/calendar", "/reminders",
  "/bookmarks", "/projects", "/contacts", "/habits", "/goals", "/resources",
  "/whiteboards",
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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return redirect(loginUrl);
  }

  // Auth routes validate the session on the server. Allowing them through
  // prevents stale cookies from bouncing forever between login and dashboard.
  if (pathname === "/" && token) return redirect(new URL("/dashboard", request.url));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
