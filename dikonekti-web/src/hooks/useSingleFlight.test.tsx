// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSingleFlight } from "./useSingleFlight";

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe("useSingleFlight", () => {
  it("runs_the_task_and_returns_its_value", async () => {
    const { result } = renderHook(() => useSingleFlight());
    let outcome;
    await act(async () => {
      outcome = await result.current.run(async () => 42);
    });
    expect(outcome).toEqual({ ok: true, value: 42 });
    expect(result.current.pending).toBe(false);
  });

  it("is_pending_while_the_task_runs", async () => {
    const d = deferred<void>();
    const { result } = renderHook(() => useSingleFlight());
    let done!: Promise<unknown>;
    act(() => {
      done = result.current.run(() => d.promise);
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      d.resolve();
      await done;
    });
    expect(result.current.pending).toBe(false);
  });

  it("ignores_a_second_call_while_one_is_in_flight", async () => {
    const d = deferred<void>();
    const task = vi.fn().mockReturnValue(d.promise);
    const { result } = renderHook(() => useSingleFlight());
    let first!: Promise<unknown>;
    let second: unknown = "unset";
    await act(async () => {
      first = result.current.run(task);
      second = await result.current.run(task);
    });
    expect(second).toBeUndefined();
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve();
      await first;
    });
  });

  it("reports_a_failure_without_throwing_and_allows_a_retry", async () => {
    const { result } = renderHook(() => useSingleFlight());
    const boom = new Error("boom");
    let outcome;
    await act(async () => {
      outcome = await result.current.run(async () => {
        throw boom;
      });
    });
    expect(outcome).toEqual({ ok: false, error: boom });
    expect(result.current.pending).toBe(false);
    await act(async () => {
      outcome = await result.current.run(async () => "again");
    });
    expect(outcome).toEqual({ ok: true, value: "again" });
  });

  it("can_stay_locked_after_success_so_a_navigating_form_cannot_be_submitted_twice", async () => {
    const task = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await result.current.run(task, { stayLockedOnSuccess: true });
    });
    expect(result.current.pending).toBe(true);
    let second: unknown = "unset";
    await act(async () => {
      second = await result.current.run(task);
    });
    expect(second).toBeUndefined();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("unlocks_after_a_failure_even_when_asked_to_stay_locked_on_success", async () => {
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("x");
      }, { stayLockedOnSuccess: true });
    });
    expect(result.current.pending).toBe(false);
  });
});
