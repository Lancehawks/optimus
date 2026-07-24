import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5_000;

function isBlockedIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export function isPrivateOrReservedIp(address) {
  const normalized = address.toLowerCase().split("%")[0];
  if (net.isIPv4(normalized)) return isBlockedIpv4(normalized);
  if (!net.isIPv6(normalized)) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("2001:db8:")
  );
}

export function normalizePublicHttpUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Only public HTTP or HTTPS URLs are allowed.");
  }

  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (!(["80", "443"].includes(port))) {
    throw new Error("Only standard web ports are allowed.");
  }

  return url;
}

async function resolvePublicAddress(hostname) {
  if (hostname.toLowerCase() === "localhost" || hostname.toLowerCase().endsWith(".local")) {
    throw new Error("Private network URLs are not allowed.");
  }

  const directFamily = net.isIP(hostname);
  const addresses = directFamily
    ? [{ address: hostname, family: directFamily }]
    : await dns.lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw new Error("Private or reserved network URLs are not allowed.");
  }

  return addresses[0].address;
}

function requestHtml(url, address) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: url.hostname,
        headers: {
          Host: url.host,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
          "User-Agent": "Optimus-Link-Preview/1.0",
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;

        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            response.destroy(new Error("Remote page is too large."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({
          status: response.statusCode || 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        }));
        response.on("error", reject);
      }
    );

    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error("Remote page timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function fetchPublicPageMetadata(value, redirects = 0) {
  const url = normalizePublicHttpUrl(value);
  const address = await resolvePublicAddress(url.hostname);
  const response = await requestHtml(url, address);

  if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
    if (redirects >= MAX_REDIRECTS) throw new Error("Remote page redirected too many times.");
    return fetchPublicPageMetadata(new URL(response.headers.location, url).toString(), redirects + 1);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const contentEncoding = String(response.headers["content-encoding"] || "identity").toLowerCase();
  if (response.status < 200 || response.status >= 300 || !contentType.includes("html") || contentEncoding !== "identity") {
    throw new Error("Remote URL did not return a supported web page.");
  }

  const titleMatch = response.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogImageMatch = response.body.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || response.body.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  let previewImageUrl = null;
  if (ogImageMatch) {
    try {
      const candidate = new URL(ogImageMatch[1], url);
      if (["http:", "https:"].includes(candidate.protocol)) previewImageUrl = candidate.toString();
    } catch {
      // An invalid image URL should not invalidate the bookmark itself.
    }
  }

  return {
    canonicalUrl: url.toString(),
    title: titleMatch?.[1]?.replace(/\s+/g, " ").trim().slice(0, 255) || "",
    previewImageUrl,
  };
}
