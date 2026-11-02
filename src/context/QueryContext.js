"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { DATA_CHANGED_EVENT } from "@/services/api";
import { queryRootsChangedBy } from "@/lib/queryInvalidation";

// Views that only depend on a written resource (project counts, Today) wait
// for a burst of writes, like ticking off several tasks, to settle.
const DEPENDENT_REFRESH_DELAY_MS = 1000;

// A refused request (signed out, forbidden, missing) won't succeed on retry.
function shouldRetry(failureCount, error) {
  if (error?.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data shows at once; anything older than this refreshes in
        // the background when a page shows it again.
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        retry: shouldRetry,
      },
    },
  });
}

// One browser cache per signed-in member. It outlives route changes, and a
// different member signing in on this browser never sees the last one's data.
let browserQueryClient = null;
let browserQueryClientUserId = null;

function getQueryClient(userId) {
  if (typeof window === "undefined") return createQueryClient();
  if (!browserQueryClient || browserQueryClientUserId !== userId) {
    browserQueryClient?.clear();
    browserQueryClient = createQueryClient();
    browserQueryClientUserId = userId;
  }
  return browserQueryClient;
}

function useRefreshAfterWrites(queryClient) {
  useEffect(() => {
    const dependentRoots = new Set();
    let dependentTimer = null;

    const refreshDependents = () => {
      for (const root of dependentRoots) {
        void queryClient.refetchQueries({ queryKey: [root], type: "active" });
      }
      dependentRoots.clear();
    };

    const handleDataChanged = (event) => {
      const { endpoint, refreshVisible = true } = event.detail || {};
      const refetchType = refreshVisible ? "active" : "none";
      const roots = queryRootsChangedBy(endpoint);
      if (roots === null) {
        void queryClient.invalidateQueries({ refetchType });
        return;
      }
      if (roots.length === 0) return;

      // Everything affected is stale now, so a page opened next refetches it.
      const [written, ...dependents] = roots;
      for (const root of dependents) {
        void queryClient.invalidateQueries({ queryKey: [root], refetchType: "none" });
      }
      void queryClient.invalidateQueries({ queryKey: [written], refetchType });
      if (!refreshVisible) return;

      dependents.forEach((root) => dependentRoots.add(root));
      clearTimeout(dependentTimer);
      dependentTimer = setTimeout(refreshDependents, DEPENDENT_REFRESH_DELAY_MS);
    };

    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      clearTimeout(dependentTimer);
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, [queryClient]);
}

export function QueryProvider({ children }) {
  const { user } = useAuth();
  const queryClient = getQueryClient(user?.id ?? null);
  useRefreshAfterWrites(queryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
