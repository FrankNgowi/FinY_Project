"use client";

import useSWR, { useSWRConfig } from "swr";
import { ApiError, apiFetch, swrFetcher } from "@/lib/api-client";
import type { AdminVerification } from "@/lib/types";

// One request feeds every tab (Pending, Approved, Rejected, All) and its count, so they cannot disagree.
export const ADMIN_LIST_KEY = "admin/verifications/?status=all";
export const ADMIN_POLL_MS = 30_000;
export const CONFLICT_MESSAGE = "This request was already decided by someone else.";

export function useVerifications() {
  return useSWR(ADMIN_LIST_KEY, swrFetcher<AdminVerification[]>, {
    refreshInterval: ADMIN_POLL_MS,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  });
}

/** Another admin decided this request first (the server answered 409). */
export class DecisionConflictError extends Error {
  constructor() {
    super(CONFLICT_MESSAGE);
    this.name = "DecisionConflictError";
  }
}

/** Approve and reject. The reply is the updated row, which replaces the old one without another list request. */
export function useDecisions() {
  const { mutate } = useSWRConfig();

  async function decide(id: number, action: "approve" | "reject", body?: { reason: string }): Promise<AdminVerification> {
    try {
      const updated = await apiFetch<AdminVerification>(`admin/verifications/${id}/${action}/`, { method: "POST", body });
      await mutate(
        ADMIN_LIST_KEY,
        (current?: AdminVerification[]) => current?.map((row) => (row.id === updated.id ? updated : row)),
        { revalidate: false },
      );
      return updated;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await mutate(ADMIN_LIST_KEY); // show what the other admin decided
        throw new DecisionConflictError();
      }
      throw error;
    }
  }

  return {
    approve: (id: number) => decide(id, "approve"),
    reject: (id: number, reason: string) => decide(id, "reject", { reason }),
  };
}

export function decisionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
