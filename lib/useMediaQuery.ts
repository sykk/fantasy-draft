"use client";

import { useSyncExternalStore } from "react";

/** True while the viewport matches; false during SSR and the first client
 *  render, so layout that depends on it settles after hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
