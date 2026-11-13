"use client";

import { useCallback, useRef, useState } from "react";

export type FlightResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

type RunOptions = {
  /** Keep the lock after a successful run, for forms that navigate away and must not be re-submitted. */
  stayLockedOnSuccess?: boolean;
};

/**
 * Guards an async action against double submits. `run` ignores calls while one is in flight
 * (returning undefined), never throws, and tracks `pending` for disabling the button.
 */
export function useSingleFlight() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T,>(task: () => Promise<T>, options: RunOptions = {}): Promise<FlightResult<T> | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      const value = await task();
      if (!options.stayLockedOnSuccess) {
        inFlight.current = false;
        setPending(false);
      }
      return { ok: true, value };
    } catch (error) {
      inFlight.current = false;
      setPending(false);
      return { ok: false, error };
    }
  }, []);

  return { pending, run };
}
