"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error("Dashboard render failed", error);
  }, [error]);

  return (
    <main className="p-6">
      <ErrorState
        title="This page could not be opened"
        description="Your data is safe. Retry the page, or return to the dashboard if the problem continues."
        onRetry={reset}
      />
    </main>
  );
}
