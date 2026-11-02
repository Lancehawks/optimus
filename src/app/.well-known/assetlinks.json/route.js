import { connection, NextResponse } from "next/server";
import { androidAssetLinks } from "@/lib/mobileAppLinks";

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
  // Answered per request from the live environment, not baked in at build.
  await connection();
  try {
    return NextResponse.json(androidAssetLinks(), {
      headers: SUCCESS_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: "Android App Link association is not configured" },
      { status: 503, headers: UNAVAILABLE_HEADERS }
    );
  }
}
