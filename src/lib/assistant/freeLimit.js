// OpenRouter counts free-model requests per account per UTC day: 50 a day
// until the account has bought at least $10 of credits, then 1,000. Each
// question takes one request per model call, usually two to six.
export function freeLimitMessage(quota, now = new Date()) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const hours = Math.max(1, Math.ceil((midnight - now.getTime()) / 3_600_000));
  return `You've used all ${quota.limit} of today's free OpenRouter requests. They reset at midnight UTC, in about ${hours} hour${hours === 1 ? "" : "s"}. Pick another model to keep going.`;
}
