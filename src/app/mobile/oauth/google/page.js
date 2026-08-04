export const metadata = {
  title: "Google Calendar connection | Optimus",
  robots: { index: false, follow: false },
};

const errorMessages = {
  access_denied: "Google Calendar access was not granted.",
  connection_failed: "Google Calendar could not be connected.",
  invalid_state: "This Google Calendar connection request expired or was already used.",
  oauth_error: "Google could not complete the Calendar connection.",
};

export default async function MobileGoogleOAuthResultPage({ searchParams }) {
  const params = await searchParams;
  const connected = params?.status === "connected";
  const message = connected
    ? "Google Calendar is connected. Open Calendar in Optimus to synchronize it immediately."
    : errorMessages[params?.reason] || errorMessages.connection_failed;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#0d1117",
        color: "#f4f7fb",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section style={{ width: "min(100%, 520px)", textAlign: "center" }}>
        <p style={{ color: connected ? "#49d3b4" : "#f5a65b", fontWeight: 700 }}>
          {connected ? "Connection complete" : "Connection not completed"}
        </p>
        <h1 style={{ margin: "12px 0", fontSize: "clamp(28px, 7vw, 44px)" }}>
          Return to Optimus
        </h1>
        <p style={{ color: "#aab4c3", lineHeight: 1.6 }}>{message}</p>
        <p style={{ color: "#aab4c3", lineHeight: 1.6 }}>
          You can close this browser window and continue in the app.
        </p>
      </section>
    </main>
  );
}
