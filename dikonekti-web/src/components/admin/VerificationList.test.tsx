// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeAdminVerification } from "@/test/fixtures";
import { VerificationList } from "./VerificationList";

const rows = [
  makeAdminVerification({ id: 1, username: "amina", display_name: "Dr. Amina", status: "pending", submitted_at: "2026-11-12T08:00:00Z" }),
  makeAdminVerification({ id: 2, username: "omar", display_name: "Dr. Omar", status: "pending", submitted_at: "2026-11-13T08:00:00Z" }),
  makeAdminVerification({ id: 3, username: "sara", display_name: "Dr. Sara", status: "approved" }),
  makeAdminVerification({ id: 4, username: "lina", display_name: "Dr. Lina", status: "rejected", rejection_reason: "Blurry" }),
  makeAdminVerification({ id: 5, username: "ali", display_name: "Dr. Ali", status: "not_submitted", submitted_at: null }),
];

function renderList() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <VerificationList />
    </SWRConfig>,
  );
}
function mockApi(list: unknown, decide?: (url: string) => Response) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).startsWith("/api/admin/verifications?")) return jsonResponse(typeof list === "function" ? (list as () => unknown)() : list);
    if (init?.method === "POST" && decide) return decide(String(url));
    throw new Error(`Unexpected ${init?.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const names = () => screen.queryAllByRole("listitem").map((li) => within(li).getByText(/^Dr\. /).textContent);
const tab = (name: RegExp) => screen.getByRole("tab", { name });

afterEach(() => vi.unstubAllGlobals());

describe("VerificationList tabs keyboard use", () => {
  async function ready() {
    mockApi(rows);
    renderList();
    await screen.findByText("Dr. Amina");
  }

  it("puts_only_the_selected_tab_in_the_tab_order", async () => {
    await ready();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
    await userEvent.click(tab(/^approved/i));
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1"]);
  });

  it("moves_and_selects_with_the_left_and_right_arrows_and_wraps_around", async () => {
    await ready();
    tab(/^pending/i).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(tab(/^approved/i)).toHaveFocus();
    expect(tab(/^approved/i)).toHaveAttribute("aria-selected", "true");
    expect(names()).toEqual(["Dr. Sara"]);
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(tab(/^all/i)).toHaveFocus();
    expect(tab(/^all/i)).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(tab(/^pending/i)).toHaveFocus();
  });

  it("jumps_to_the_first_and_last_tab_with_home_and_end", async () => {
    await ready();
    tab(/^pending/i).focus();
    await userEvent.keyboard("{End}");
    expect(tab(/^all/i)).toHaveFocus();
    expect(tab(/^all/i)).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(tab(/^pending/i)).toHaveFocus();
  });

  it("leaves_the_tab_list_with_the_tab_key_instead_of_walking_through_every_tab", async () => {
    await ready();
    tab(/^pending/i).focus();
    await userEvent.tab();
    expect(screen.getAllByRole("tab").some((t) => t === document.activeElement)).toBe(false);
  });

  it("ignores_other_keys", async () => {
    await ready();
    tab(/^pending/i).focus();
    await userEvent.keyboard("a{ArrowDown}{ArrowUp}");
    expect(tab(/^pending/i)).toHaveFocus();
    expect(tab(/^pending/i)).toHaveAttribute("aria-selected", "true");
  });
});

describe("VerificationList", () => {
  it("shows_a_loading_state_first", () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    renderList();
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });

  it("opens_on_the_pending_tab_with_the_oldest_request_first_and_counts_on_every_tab", async () => {
    mockApi(rows);
    renderList();
    await screen.findByText("Dr. Amina");
    expect(tab(/^pending/i)).toHaveAttribute("aria-selected", "true");
    expect(names()).toEqual(["Dr. Amina", "Dr. Omar"]);
    expect(tab(/^pending/i).textContent).toContain("2");
    expect(tab(/^approved/i).textContent).toContain("1");
    expect(tab(/^rejected/i).textContent).toContain("1");
    expect(tab(/^all/i).textContent).toContain("5");
  });

  it("switches_tabs_and_shows_the_status_badge_outside_pending", async () => {
    mockApi(rows);
    renderList();
    await screen.findByText("Dr. Amina");
    await userEvent.click(tab(/^approved/i));
    expect(names()).toEqual(["Dr. Sara"]);
    expect(tab(/^approved/i)).toHaveAttribute("aria-selected", "true");
    await userEvent.click(tab(/^all/i));
    expect(names()).toHaveLength(5);
    expect(screen.getAllByText("Not submitted", { selector: "[data-status]" })).toHaveLength(1);
    await userEvent.click(tab(/^rejected/i));
    expect(screen.getByText(/reason: blurry/i)).toBeInTheDocument();
  });

  it("shows_the_empty_state_for_pending_when_nothing_is_waiting", async () => {
    mockApi([rows[2]]);
    renderList();
    expect(await screen.findByText("Nothing waiting for review.")).toBeInTheDocument();
    expect(tab(/^pending/i).textContent).toContain("0");
  });

  it("shows_a_message_when_there_are_no_doctors_at_all", async () => {
    mockApi([]);
    renderList();
    expect(await screen.findByText("Nothing waiting for review.")).toBeInTheDocument();
    await userEvent.click(tab(/^all/i));
    expect(screen.getByText(/no doctors/i)).toBeInTheDocument();
  });

  it("moves_a_decided_row_to_its_new_tab_without_reloading", async () => {
    const fetchMock = mockApi(rows, () => jsonResponse({ ...rows[0], status: "approved" }));
    renderList();
    await screen.findByText("Dr. Amina");
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(names()).toEqual(["Dr. Omar"]));
    expect(tab(/^pending/i).textContent).toContain("1");
    expect(tab(/^approved/i).textContent).toContain("2");
    const listGets = fetchMock.mock.calls.filter(([u, i]) => String(u).startsWith("/api/admin/verifications?") && (i?.method ?? "GET") === "GET");
    expect(listGets).toHaveLength(1);
    await userEvent.click(tab(/^approved/i));
    expect(names()).toContain("Dr. Amina");
  });

  it("rejects_through_the_dialog_and_moves_the_row_to_rejected", async () => {
    mockApi(rows, () => jsonResponse({ ...rows[1], status: "rejected", rejection_reason: "Not legible" }));
    renderList();
    await screen.findByText("Dr. Omar");
    await userEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: "Reject" }));
    await userEvent.type(within(screen.getByRole("dialog")).getByLabelText(/reason/i), "Not legible");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(names()).toEqual(["Dr. Amina"]));
    expect(tab(/^rejected/i).textContent).toContain("2");
  });

  it("keeps_the_conflict_message_on_screen_after_the_list_refreshes_and_the_row_is_gone", async () => {
    // Regression: the refresh removed the very row that showed the message, so nobody could read it.
    let calls = 0;
    mockApi(
      () => (calls++ === 0 ? rows : rows.map((r) => (r.id === 1 ? { ...r, status: "approved" } : r))),
      () => jsonResponse({ detail: "already" }, 409),
    );
    renderList();
    await screen.findByText("Dr. Amina");
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(names()).toEqual(["Dr. Omar"]));
    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain("This request was already decided by someone else.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("shows_the_same_message_once_even_when_the_decided_row_stays_visible_on_the_all_tab", async () => {
    let calls = 0;
    mockApi(
      () => (calls++ === 0 ? rows : rows.map((r) => (r.id === 1 ? { ...r, status: "approved" } : r))),
      () => jsonResponse({ detail: "already" }, 409),
    );
    renderList();
    await screen.findByText("Dr. Amina");
    await userEvent.click(tab(/^all/i));
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("already decided by someone else"));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("explains_a_conflict_on_a_rejection_too_and_closes_the_dialog", async () => {
    let calls = 0;
    mockApi(
      () => (calls++ === 0 ? rows : rows.map((r) => (r.id === 2 ? { ...r, status: "approved" } : r))),
      () => jsonResponse({ detail: "already" }, 409),
    );
    renderList();
    await screen.findByText("Dr. Omar");
    await userEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: "Reject" }));
    await userEvent.type(within(screen.getByRole("dialog")).getByLabelText(/reason/i), "No licence");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("alert").textContent).toContain("already decided by someone else");
  });

  it("lets_the_admin_dismiss_the_conflict_message", async () => {
    let calls = 0;
    mockApi(
      () => (calls++ === 0 ? rows : rows.map((r) => (r.id === 1 ? { ...r, status: "approved" } : r))),
      () => jsonResponse({ detail: "already" }, 409),
    );
    renderList();
    await screen.findByText("Dr. Amina");
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Approve" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears_the_conflict_message_after_the_next_successful_decision", async () => {
    let calls = 0;
    mockApi(
      () => (calls++ === 0 ? rows : rows.map((r) => (r.id === 1 ? { ...r, status: "approved" } : r))),
      (url) => (url.includes("/1/") ? jsonResponse({ detail: "already" }, 409) : jsonResponse({ ...rows[1], status: "approved" })),
    );
    renderList();
    await screen.findByText("Dr. Amina");
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Approve" }));
    await screen.findByRole("alert");
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows_an_error_banner_with_retry_and_keeps_the_list_when_a_refresh_fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(async () => jsonResponse(rows))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockImplementation(async () => jsonResponse(rows));
      vi.stubGlobal("fetch", fetchMock);
      renderList();
      await screen.findByText("Dr. Amina");
      await act(async () => { await vi.advanceTimersByTimeAsync(31_000); }); // the 30 s refresh fails
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/could not load/i);
      expect(names()).toEqual(["Dr. Amina", "Dr. Omar"]);
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows_the_banner_with_retry_when_the_first_load_fails_and_no_list_yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockImplementation(async () => jsonResponse(rows)));
    renderList();
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not load/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Dr. Amina")).toBeInTheDocument();
  });
});
