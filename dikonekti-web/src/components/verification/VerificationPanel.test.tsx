// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/fixtures";
import { VerificationPanel } from "./VerificationPanel";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

const record = (status: string, extra: Record<string, unknown> = {}) => ({
  status,
  submitted_at: null,
  rejection_reason: "",
  ...extra,
});

function renderPanel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <VerificationPanel />
    </SWRConfig>,
  );
}
const statusCall = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url, init]) => url === "/api/me/verification" && (init?.method ?? "GET") === "GET");

beforeEach(() => replace.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("VerificationPanel", () => {
  it("shows_a_loading_state_before_the_status_arrives", () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    renderPanel();
    expect(screen.getByRole("status").textContent).toMatch(/checking your document status/i);
  });

  it("asks_a_doctor_who_has_not_submitted_to_upload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(record("not_submitted"))));
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Upload your confirmation letter or certificate" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy();
  });

  it("shows_the_submitted_date_and_no_upload_form_while_pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(record("pending", { submitted_at: "2026-11-13T10:42:00Z" }))),
    );
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Your document is under review" })).toBeTruthy();
    expect(screen.getByText(/submitted 13 nov 2026/i)).toBeTruthy();
    expect(screen.getByText(/we will unlock your dashboard once it is approved/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
    expect(screen.queryByLabelText(/confirmation letter or certificate/i, { selector: "input" })).toBeNull();
  });

  it("shows_the_reviewers_reason_and_a_form_after_a_rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(record("rejected", { rejection_reason: "The scan is blurry." }))),
    );
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Your document was not accepted" })).toBeTruthy();
    expect(screen.getByText(/reason: the scan is blurry\./i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit again" })).toBeTruthy();
  });

  it("shows_a_reason_with_markup_as_plain_text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(record("rejected", { rejection_reason: "<img src=x onerror=alert(1)>" }))),
    );
    const { container } = renderPanel();
    await screen.findByRole("heading", { name: "Your document was not accepted" });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeTruthy();
  });

  it("opens_the_dashboard_when_the_doctor_is_approved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(record("approved"))));
    renderPanel();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it.each([["suspended"], [""], ["APPROVED"]])(
    "does_not_claim_approval_or_leave_the_page_for_the_unknown_status_%j",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(record(status)))
        .mockResolvedValue(jsonResponse(record("not_submitted")));
      vi.stubGlobal("fetch", fetchMock);
      renderPanel();
      expect((await screen.findByRole("alert")).textContent).toMatch(/could not read your verification status/i);
      expect(screen.queryByText(/approved\. opening/i)).toBeNull();
      expect(replace).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByRole("heading", { name: "Upload your confirmation letter or certificate" })).toBeTruthy();
    },
  );

  it("does_not_leave_the_page_for_the_other_statuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(record("pending"))));
    renderPanel();
    await screen.findByRole("heading", { name: "Your document is under review" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("moves_to_the_pending_panel_after_a_successful_upload_without_asking_again", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") return jsonResponse(record("pending", { submitted_at: "2026-11-13T10:42:00Z" }));
      return jsonResponse(record("not_submitted"));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    const u = userEvent.setup();
    await u.upload(await screen.findByLabelText(/confirmation letter or certificate/i, { selector: "input" }), new File([new Uint8Array(10)], "c.pdf", { type: "application/pdf" }));
    await u.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByRole("heading", { name: "Your document is under review" })).toBeTruthy();
    expect(statusCall(fetchMock)).toHaveLength(1);
  });

  it("shows_an_error_banner_with_retry_when_the_status_cannot_be_loaded", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(jsonResponse(record("not_submitted")));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not load your verification status/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Upload your confirmation letter or certificate" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("VerificationPanel polling for a decision", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  /** GET answers walk through `statuses` (the last one repeats); any POST answers "pending". */
  function api(statuses: string[]) {
    let next = 0;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") return jsonResponse(record("pending", { submitted_at: "2026-11-13T10:42:00Z" }));
      return jsonResponse(record(statuses[Math.min(next++, statuses.length - 1)]));
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it("checks_again_after_30_seconds_while_pending_and_opens_the_dashboard_when_approved", async () => {
    const fetchMock = api(["pending", "approved"]);
    renderPanel();
    await screen.findByRole("heading", { name: "Your document is under review" });
    expect(statusCall(fetchMock)).toHaveLength(1);
    await advance(29_000);
    expect(statusCall(fetchMock)).toHaveLength(1);
    await advance(2_000);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(statusCall(fetchMock)).toHaveLength(2);
  });

  it("starts_checking_after_the_doctor_submits_in_this_same_visit", async () => {
    // Regression: the upload put "pending" into the cache without a new request, so the first
    // check was never scheduled and the doctor waited forever on a page that never moved on.
    const fetchMock = api(["not_submitted", "approved"]);
    renderPanel();
    const u = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    await u.upload(
      await screen.findByLabelText(/confirmation letter or certificate/i, { selector: "input" }),
      new File([new Uint8Array(10)], "c.pdf", { type: "application/pdf" }),
    );
    await u.click(screen.getByRole("button", { name: "Submit for review" }));
    await screen.findByRole("heading", { name: "Your document is under review" });
    expect(statusCall(fetchMock)).toHaveLength(1);
    await advance(31_000);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("keeps_checking_every_30_seconds_while_still_pending", async () => {
    const fetchMock = api(["pending"]);
    renderPanel();
    await screen.findByRole("heading", { name: "Your document is under review" });
    await advance(95_000);
    expect(statusCall(fetchMock).length).toBeGreaterThanOrEqual(4);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([["not_submitted"], ["rejected"]])("does_not_poll_while_the_status_is_%s", async (status) => {
    const fetchMock = api([status]);
    renderPanel();
    await screen.findByRole("heading");
    await advance(120_000);
    expect(statusCall(fetchMock)).toHaveLength(1);
  });

  it("does_not_poll_while_the_tab_is_hidden", async () => {
    const fetchMock = api(["pending", "approved"]);
    renderPanel();
    await screen.findByRole("heading", { name: "Your document is under review" });
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await advance(120_000);
    expect(statusCall(fetchMock)).toHaveLength(1);
    hidden.mockRestore();
  });

  it("stops_checking_after_it_is_closed", async () => {
    const fetchMock = api(["pending"]);
    const { unmount } = renderPanel();
    await screen.findByRole("heading", { name: "Your document is under review" });
    unmount();
    await advance(120_000);
    expect(statusCall(fetchMock)).toHaveLength(1);
  });
});
