import { useEffect } from "react";

export function useKeyboard(keyMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function handler(e) {
      const fn = keyMap[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [keyMap, enabled]);
}
