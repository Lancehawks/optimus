import { query } from "@/lib/db";
import { apiResponse } from "@/lib/apiUtils";
import { isEmailDeliveryConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
    email: isEmailDeliveryConfigured(),
    tokenEncryption: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
    publicUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };

  try {
    await query("SELECT 1");
    checks.database = true;
  } catch {
    // Do not expose connection errors or credentials in a public health route.
  }

  const productionReady = process.env.NODE_ENV !== "production"
    ? checks.database
    : Object.values(checks).every(Boolean);

  return apiResponse(
    {
      status: productionReady ? "ok" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    productionReady ? 200 : 503
  );
}
