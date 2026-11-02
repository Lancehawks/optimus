"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Application render failed", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f3f0", color: "#1a1917" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "24px",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          }}
        >
          <section style={{ maxWidth: "440px", textAlign: "center" }} role="alert">
            <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "40px", lineHeight: 1.05, margin: 0 }}>
              Optimus couldn&apos;t open.
            </h1>
            <p style={{ color: "#79746c", fontSize: "14px", margin: "16px 0 24px" }}>
              Your data is safe. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: 0,
                background: "#3346d3",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
