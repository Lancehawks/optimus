"use client";

import { useEffect } from "react";
import { DATA_CHANGED_EVENT } from "@/services/api";

// Reloads a page's data after a change confirmed in the assistant panel, which
// sits on top of the page and shares none of its state.
export function useAssistantChanges(refetch) {
  useEffect(() => {
    const handleChange = (event) => {
      if (event.detail?.endpoint?.startsWith("/assistant/actions/")) refetch();
    };
    window.addEventListener(DATA_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handleChange);
  }, [refetch]);
}
