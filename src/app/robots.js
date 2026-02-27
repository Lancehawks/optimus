const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: [
          "/dashboard",
          "/tasks",
          "/notes",
          "/calendar",
          "/bookmarks",
          "/habits",
          "/projects",
          "/resources",
          "/whiteboards",
          "/settings",
          "/ai",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
