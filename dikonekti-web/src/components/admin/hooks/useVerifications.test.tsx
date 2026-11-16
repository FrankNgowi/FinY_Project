// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { jsonResponse, makeAdminVerification } from "@/test/fixtures";
import {
  ADMIN_POLL_MS,
  CONFLICT_MESSAGE,
  DecisionConflictError,
  decisionErrorMessage,
  useDecisions,
  useVerifications,
} from "./useVerifications";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>{children}</SWRConfig>
);
const list = [makeAdminVerification({ id: 1 }), makeAdminVerification({ id: 2, username: "omar", display_name: "Dr. Omar" })];
const listCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).startsWith("/api/admin/verifications?") && (init?.method ?? "GET") === "GET");

afterEach(() => vi.unstubAllGlobals());

describe("useVerifications", () => {
  it("loads_the_whole_list_with_one_request_for_every_tab", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(list));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useVerifications(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/verifications?status=all");
    expect(ADMIN_POLL_MS).toBe(30_000);
  });
});

function setup(decision: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).startsWith("/api/admin/verifications?")) return jsonResponse(list);
    return decision(String(url), init);
  });
  vi.stubGlobal("fetch", fetchMock);
  const hook = renderHook(() => ({ rows: useVerifications(), decisions: useDecisions() }), { wrapper });
  return { fetchMock, ...hook };
}

describe("useDecisions", () => {
  it("approves_with_a_post_that_has_no_body_and_puts_the_new_row_in_the_list_without_asking_again", async () => {
    const { fetchMock, result } = setup(() => jsonResponse(makeAdminVerification({ id: 1, status: "approved" })));
    await waitFor(() => expect(result.current.rows.data).toHaveLength(2));
    await act(async () => { await result.current.decisions.approve(1); });
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("approve"))!;
    expect(url).toBe("/api/admin/verifications/1/approve");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(result.current.rows.data?.map((r) => r.status)).toEqual(["approved", "pending"]);
    expect(listCalls(fetchMock)).toHaveLength(1);
  });

  it("rejects_with_the_reason_as_json", async () => {
    const { fetchMock, result } = setup(() => jsonResponse(makeAdminVerification({ id: 2, status: "rejected", rejection_reason: "Blurry" })));
    await waitFor(() => expect(result.current.rows.data).toHaveLength(2));
    await act(async () => { await result.current.decisions.reject(2, "Blurry"); });
    const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("reject"))!;
    expect(url).toBe("/api/admin/verifications/2/reject");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ reason: "Blurry" });
    expect(result.current.rows.data?.[1].status).toBe("rejected");
  });

  it("turns_a_409_into_a_conflict_error_and_reloads_the_list", async () => {
    const { fetchMock, result } = setup(() => jsonResponse({ detail: "This request was already decided." }, 409));
    await waitFor(() => expect(result.current.rows.data).toHaveLength(2));
    let caught: unknown;
    await act(async () => { await result.current.decisions.approve(1).catch((e) => (caught = e)); });
    expect(caught).toBeInstanceOf(DecisionConflictError);
    await waitFor(() => expect(listCalls(fetchMock).length).toBe(2));
  });

  it.each([[400], [403], [500]])("passes_a_%i_through_as_an_api_error_without_touching_the_list", async (status) => {
    const { fetchMock, result } = setup(() => jsonResponse({ detail: `failed ${status}` }, status));
    await waitFor(() => expect(result.current.rows.data).toHaveLength(2));
    let caught: unknown;
    await act(async () => { await result.current.decisions.approve(1).catch((e) => (caught = e)); });
    expect(caught).toMatchObject({ name: "ApiError", status, message: `failed ${status}` });
    expect(result.current.rows.data?.map((r) => r.status)).toEqual(["pending", "pending"]);
    expect(listCalls(fetchMock)).toHaveLength(1);
  });

  it("only_replaces_the_row_that_was_decided", async () => {
    const { result } = setup(() => jsonResponse(makeAdminVerification({ id: 2, username: "omar", display_name: "Dr. Omar", status: "approved" })));
    await waitFor(() => expect(result.current.rows.data).toHaveLength(2));
    await act(async () => { await result.current.decisions.approve(2); });
    expect(result.current.rows.data?.map((r) => [r.id, r.status])).toEqual([[1, "pending"], [2, "approved"]]);
  });
});

describe("decisionErrorMessage", () => {
  it("explains_a_conflict_in_plain_words", () => {
    expect(CONFLICT_MESSAGE).toBe("This request was already decided by someone else.");
    expect(decisionErrorMessage(new DecisionConflictError())).toBe(CONFLICT_MESSAGE);
  });

  it("shows_other_errors_with_their_own_message", () => {
    expect(decisionErrorMessage(new ApiError(400, "Enter a reason."))).toBe("Enter a reason.");
    expect(decisionErrorMessage(new ApiError(0, "Could not reach the server."))).toBe("Could not reach the server.");
    expect(decisionErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls_back_for_anything_else", () => {
    expect(decisionErrorMessage("weird")).toBe("Something went wrong. Please try again.");
    expect(decisionErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});
