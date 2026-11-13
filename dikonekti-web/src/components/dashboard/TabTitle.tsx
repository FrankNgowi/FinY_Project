"use client";

import { useEffect } from "react";

const BASE_TITLE = "Dikonekti";

/** Keeps the browser tab title in sync with the number of active alerts. */
export function TabTitle({ activeAlertCount }: { activeAlertCount: number | null }) {
  useEffect(() => {
    document.title = activeAlertCount && activeAlertCount > 0 ? `(${activeAlertCount}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [activeAlertCount]);
  return null;
}
