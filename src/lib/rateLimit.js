import crypto from "crypto";
import { queryWithConnectionRetry } from "@/lib/db";

function getClientIp(request) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function hashIdentifier(identifier) {
  if (!identifier) return "none";
  return crypto
    .createHash("sha256")
    .update(String(identifier).trim().toLowerCase())
    .digest("hex");
}

// perIp: false shares one bucket across every client address, so rotating IPs
// cannot reset an identifier's budget. Existing per-IP bucket keys are unchanged.
export async function checkRateLimit(request, { scope, identifier, limit, windowMs, perIp = true }) {
  const client = perIp ? getClientIp(request) : "any-ip";
  const key = crypto
    .createHash("sha256")
    .update(`${scope}:${client}:${hashIdentifier(identifier)}`)
    .digest("hex");

  // This atomic upsert is safe to retry for connection recovery. In the rare
  // case where the first response is lost after commit, the conservative extra
  // increment preserves rate-limit security rather than failing login with 500.
  const result = await queryWithConnectionRetry(
    `INSERT INTO rate_limit_buckets (bucket_key, request_count, reset_at, updated_at)
     VALUES ($1, 1, NOW() + ($2 * INTERVAL '1 millisecond'), NOW())
     ON CONFLICT (bucket_key) DO UPDATE SET
       request_count = CASE
         WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
         ELSE LEAST(rate_limit_buckets.request_count + 1, $3 + 1)
       END,
       reset_at = CASE
         WHEN rate_limit_buckets.reset_at <= NOW()
           THEN NOW() + ($2 * INTERVAL '1 millisecond')
         ELSE rate_limit_buckets.reset_at
       END,
       updated_at = NOW()
     RETURNING request_count, reset_at`,
    [key, windowMs, limit]
  );

  const bucket = result.rows[0];
  return {
    allowed: bucket.request_count <= limit,
    remaining: Math.max(0, limit - bucket.request_count),
    resetAt: new Date(bucket.reset_at).getTime(),
  };
}

export async function checkRateLimits(request, rules) {
  for (const rule of rules) {
    const result = await checkRateLimit(request, rule);
    if (!result.allowed) {
      return result;
    }
  }

  return { allowed: true };
}
