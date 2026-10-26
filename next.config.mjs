/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Retired public pages and renamed workspace routes. Query strings carry over.
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: true },
      { source: "/signup", destination: "/", permanent: true },
      { source: "/contact", destination: "/", permanent: true },
      { source: "/habits", destination: "/routines", permanent: true },
      { source: "/bookmarks", destination: "/library?tab=links", permanent: true },
      { source: "/resources", destination: "/library", permanent: true },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "object-src 'none'",
          `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          // Uploads go from the browser straight to Vercel Blob.
          "connect-src 'self' https://*.googleapis.com https://accounts.google.com https://vercel.com https://*.blob.vercel-storage.com",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
