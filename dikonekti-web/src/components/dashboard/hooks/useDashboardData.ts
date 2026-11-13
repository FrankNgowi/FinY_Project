"use client";

import useSWR, { useSWRConfig } from "swr";
import { apiFetch, swrFetcher } from "@/lib/api-client";
import type { EmergencyAlert, UserProfile } from "@/lib/types";

export const POLL_INTERVAL_MS = 12_000;

// Poll while the tab is visible; keep the last good data if a refresh fails.
const polling = {
  refreshInterval: POLL_INTERVAL_MS,
  refreshWhenHidden: false,
  // Keep trying while the browser says it is offline: a paused poll would leave stale
  // alerts on screen with no warning. The failed attempt is what raises the error banner.
  refreshWhenOffline: true,
  revalidateOnFocus: true,
} as const;

export const ALERTS_KEY = "alerts/";
export const PATIENTS_KEY = "patients/";

export function useAlerts() {
  return useSWR(ALERTS_KEY, swrFetcher<EmergencyAlert[]>, polling);
}

// The patient list only changes when someone registers, so it refreshes far less often than alerts.
const PATIENTS_POLL_INTERVAL_MS = 5 * 60_000;

export function usePatients() {
  return useSWR(PATIENTS_KEY, swrFetcher<UserProfile[]>, { ...polling, refreshInterval: PATIENTS_POLL_INTERVAL_MS });
}

/** Returns a function that acknowledges an alert and updates the cached list. */
export function useAcknowledge() {
  const { mutate } = useSWRConfig();
  return async function acknowledge(id: number): Promise<void> {
    const updated = await apiFetch<EmergencyAlert>(`alerts/${id}/acknowledge/`, { method: "PATCH", body: {} });
    await mutate(
      ALERTS_KEY,
      (current?: EmergencyAlert[]) => current?.map((alert) => (alert.id === updated.id ? updated : alert)),
      { revalidate: false },
    );
  };
}
