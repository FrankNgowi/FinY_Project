"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

// One shared timer for every consumer, running only while something is mounted.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let snapshot = new Date();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    snapshot = new Date();
    timer = setInterval(() => {
      snapshot = new Date();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The current time, refreshed every 30 seconds, so relative times ("4m ago") keep advancing. */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
