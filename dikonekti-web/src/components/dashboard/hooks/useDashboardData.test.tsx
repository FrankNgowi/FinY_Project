// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeAlert } from "@/test/fixtures";
import { useAcknowledge, useAlerts, usePatients } from "./useDashboardData";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>{children}</SWRConfig>
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.dispatchEvent(new Event("online"));
});

describe("useDashboardData", () => {
  it("useAlerts_loads_alerts_from_the_proxy", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([makeAlert({ id: 1 })]));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAlerts(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/alerts");
  });

  it("usePatients_surfaces_errors_without_data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ detail: "Forbidden" }, 403)));
    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
  });

  it("acknowledge_patches_and_updates_the_cached_alert_without_a_refetch", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([makeAlert({ id: 1 }), makeAlert({ id: 2 })]))
      .mockImplementationOnce(async () => jsonResponse(makeAlert({ id: 2, acknowledged: true })));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => ({ alerts: useAlerts(), acknowledge: useAcknowledge() }), { wrapper });
    await waitFor(() => expect(result.current.alerts.data).toHaveLength(2));
    await act(async () => {
      await result.current.acknowledge(2);
    });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/alerts/2/acknowledge");
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    expect(result.current.alerts.data?.find((a) => a.id === 2)?.acknowledged).toBe(true);
    expect(result.current.alerts.data?.find((a) => a.id === 1)?.acknowledged).toBe(false);
  });

  it("acknowledge_failure_rejects_and_leaves_the_alert_active", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([makeAlert({ id: 1 })]))
      .mockImplementationOnce(async () => jsonResponse({ detail: "You do not have permission to perform this action." }, 403));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => ({ alerts: useAlerts(), acknowledge: useAcknowledge() }), { wrapper });
    await waitFor(() => expect(result.current.alerts.data).toHaveLength(1));
    await expect(result.current.acknowledge(1)).rejects.toThrow(/permission/);
    expect(result.current.alerts.data?.[0].acknowledged).toBe(false);
  });

  it("keeps_polling_while_the_browser_reports_offline_so_stale_alerts_get_flagged", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([makeAlert({ id: 1 })]));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAlerts(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_500);
    });

    // A paused poll would leave a doctor staring at stale alerts with no warning.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The failed attempt is what raises the dashboard's error banner (checked in the browser).
    // Stale data stays available meanwhile.
    expect(result.current.data).toHaveLength(1);
  });

  it("usePatients_does_not_poll_at_the_alert_rate_because_the_list_rarely_changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
