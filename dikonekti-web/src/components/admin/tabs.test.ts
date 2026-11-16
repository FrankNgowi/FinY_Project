import { describe, expect, it } from "vitest";
import type { VerificationStatus } from "@/lib/types";
import { makeAdminVerification } from "@/test/fixtures";
import { TABS, tabCounts, tabRecords } from "./tabs";

const rec = (id: number, status: VerificationStatus) => makeAdminVerification({ id, status });
const list = [rec(1, "pending"), rec(2, "approved"), rec(3, "rejected"), rec(4, "pending"), rec(5, "not_submitted")];

describe("tabs", () => {
  it("are_pending_approved_rejected_all_in_that_order_with_pending_first", () => {
    expect(TABS.map((t) => t.key)).toEqual(["pending", "approved", "rejected", "all"]);
    expect(TABS.map((t) => t.label)).toEqual(["Pending", "Approved", "Rejected", "All"]);
  });
});

describe("tabRecords", () => {
  it("puts_each_status_in_its_own_tab_and_keeps_the_given_order", () => {
    expect(tabRecords(list, "pending").map((r) => r.id)).toEqual([1, 4]);
    expect(tabRecords(list, "approved").map((r) => r.id)).toEqual([2]);
    expect(tabRecords(list, "rejected").map((r) => r.id)).toEqual([3]);
  });

  it("shows_everything_including_doctors_who_never_submitted_in_all", () => {
    expect(tabRecords(list, "all").map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps_a_never_submitted_doctor_out_of_the_three_status_tabs", () => {
    for (const tab of ["pending", "approved", "rejected"] as const) {
      expect(tabRecords(list, tab).some((r) => r.id === 5)).toBe(false);
    }
  });

  it("returns_an_empty_list_for_an_empty_list", () => {
    for (const { key } of TABS) expect(tabRecords([], key)).toEqual([]);
  });

  it("only_shows_an_unknown_future_status_under_all", () => {
    const odd = [makeAdminVerification({ id: 9, status: "suspended" as never })];
    expect(tabRecords(odd, "all")).toHaveLength(1);
    for (const tab of ["pending", "approved", "rejected"] as const) expect(tabRecords(odd, tab)).toEqual([]);
  });

  it("does_not_change_the_list_it_was_given", () => {
    const copy = [...list];
    tabRecords(list, "pending");
    expect(list).toEqual(copy);
  });
});

describe("tabCounts", () => {
  it("counts_every_tab", () => {
    expect(tabCounts(list)).toEqual({ pending: 2, approved: 1, rejected: 1, all: 5 });
  });

  it("gives_zero_for_an_empty_list", () => {
    expect(tabCounts([])).toEqual({ pending: 0, approved: 0, rejected: 0, all: 0 });
  });

  it("matches_the_length_of_each_tab", () => {
    const counts = tabCounts(list);
    for (const { key } of TABS) expect(counts[key]).toBe(tabRecords(list, key).length);
  });
});
