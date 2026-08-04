"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/** True once the client has hydrated; false during SSR and the first client render. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
