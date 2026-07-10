import crypto from "crypto";

const buckets = new Map();
const MAX_BUCKETS = 5000;

function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
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

function pruneExpiredBuckets(now) {
  if (buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(request, { scope, identifier, limit, windowMs }) {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = `${scope}:${getClientIp(request)}:${hashIdentifier(identifier)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function checkRateLimits(request, rules) {
  for (const rule of rules) {
    const result = checkRateLimit(request, rule);
    if (!result.allowed) {
      return result;
    }
  }

  return { allowed: true };
}
