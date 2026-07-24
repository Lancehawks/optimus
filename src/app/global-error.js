"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Application render failed", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", fontFamily: "system-ui" }}>
          <section style={{ maxWidth: "480px", textAlign: "center" }} role="alert">
            <h1>Optimus could not finish opening</h1>
            <p>Your data is safe. Check your connection and try again.</p>
            <button type="button" onClick={reset} style={{ padding: "10px 16px", cursor: "pointer" }}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
