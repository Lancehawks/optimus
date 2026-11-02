"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks which registered area of a scroll container is most visible.
 * Areas register via `registerArea(id, element)` and carry `data-area={id}`.
 */
export function useScrollSpy(initialArea) {
  const [activeArea, setActiveArea] = useState(initialArea);
  const scrollRef = useRef(null);
  const areaRefs = useRef({});

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;

    const intersections = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => intersections.set(entry.target, entry));
        const visible = [...intersections.values()]
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.dataset.area) setActiveArea(visible.target.dataset.area);
      },
      { root, rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.2, 0.5] }
    );

    Object.values(areaRefs.current).forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const registerArea = useCallback((area, element) => {
    if (element) areaRefs.current[area] = element;
  }, []);

  const moveToArea = useCallback((area) => {
    setActiveArea(area);
    areaRefs.current[area]?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  return { scrollRef, activeArea, registerArea, moveToArea };
}
