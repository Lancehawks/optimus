"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error("Dashboard render failed", error);
  }, [error]);

  return (
    <main className="page">
      <ErrorState
        title="This page couldn't open"
        description="Your data is safe. Try again, or head back to Today if it keeps happening."
        onRetry={reset}
      />
      <p className="text-center">
        <Link href="/dashboard" className="text-xs text-muted underline underline-offset-4 hover:text-heading">
          Back to Today
        </Link>
      </p>
    </main>
  );
}
