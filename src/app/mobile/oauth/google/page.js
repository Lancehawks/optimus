import { CheckCircle2, CircleAlert } from "lucide-react";
import { OptimusWordmark } from "@/components/brand/OptimusLogo";

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
  const Icon = connected ? CheckCircle2 : CircleAlert;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <OptimusWordmark size={22} />
      <section className="mt-12 w-full max-w-md">
        <p className={`inline-flex items-center gap-2 text-sm font-medium ${connected ? "text-success" : "text-warning"}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          {connected ? "Connection complete" : "Connection not completed"}
        </p>
        <h1 className="text-display mt-4">Return to Optimus</h1>
        <p className="mt-4 text-sm text-muted">{message}</p>
        <p className="mt-2 text-sm text-muted">You can close this window and continue in the app.</p>
      </section>
    </main>
  );
}
