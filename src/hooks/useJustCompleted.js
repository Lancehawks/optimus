"use client";

import { useState } from "react";

// True once `done` turns on while the item is on screen, so ticking it off
// can be celebrated without replaying for items that were done on load.
export function useJustCompleted(done) {
  const [previous, setPrevious] = useState(done);
  const [celebrate, setCelebrate] = useState(false);
  if (done !== previous) {
    setPrevious(done);
    setCelebrate(done);
  }
  return celebrate && done;
}
