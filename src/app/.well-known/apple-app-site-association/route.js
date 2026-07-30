import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@/lib/mobileAppLinks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUCCESS_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "X-Content-Type-Options": "nosniff",
};

const UNAVAILABLE_HEADERS = {
  "Cache-Control": "no-store",
  "Retry-After": "300",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  try {
    return NextResponse.json(appleAppSiteAssociation(), {
      headers: SUCCESS_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: "Apple App Link association is not configured" },
      { status: 503, headers: UNAVAILABLE_HEADERS }
    );
  }
}
