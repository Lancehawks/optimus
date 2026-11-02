"use client";

import { useLayoutEffect } from "react";

// Recently visited pages stay mounted but hidden (Cache Components keeps them
// in React's <Activity>). A popover closes as its page is hidden, so coming
// back never finds one still open. Pass the popover's state setter.
export function useCloseWhenHidden(setOpen) {
  useLayoutEffect(() => () => setOpen(false), [setOpen]);
}
