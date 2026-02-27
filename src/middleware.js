import { NextResponse } from "next/server";

const protectedPaths = ["/dashboard", "/tasks", "/notes", "/settings", "/calendar", "/reminders", "/bookmarks", "/projects", "/contacts", "/habits", "/goals"];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("optimus_token")?.value;

  // Check if the path is protected
  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from the homepage and auth pages
  const isAuthPage = pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password";
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
