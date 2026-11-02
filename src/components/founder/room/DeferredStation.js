"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FounderRoom.module.css";

/** Mounts its station (and its data requests) only once it nears the viewport. */
export function DeferredStation({ children }) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "65% 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={styles.deferredStation} aria-busy={!ready}>
      {ready ? children : <span className={styles.stationPlaceholder}>Preparing this area...</span>}
    </div>
  );
}
