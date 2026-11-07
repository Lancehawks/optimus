// Only a header that the proxy in front of the app overwrites can be trusted.
// A client can send any other one and rotate its rate-limit bucket at will.
// Vercel sets x-vercel-forwarded-for; Coolify's Traefik sets x-real-ip from the
// connection. Behind Cloudflare's proxy, set CLIENT_IP_HEADER=cf-connecting-ip.
const CLIENT_IP_HEADER = process.env.VERCEL
  ? "x-vercel-forwarded-for"
  : (process.env.CLIENT_IP_HEADER || "x-real-ip").toLowerCase();

export function getClientIp(request) {
  return request.headers.get(CLIENT_IP_HEADER)?.split(",")[0]?.trim() || null;
}
