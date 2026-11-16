import type { AdminVerification } from "@/lib/types";

export type TabKey = "pending" | "approved" | "rejected" | "all";

/** Pending comes first: it is the queue an admin came to work through. */
export const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/** One list feeds every tab, so the counts and the rows can never disagree. */
export function tabRecords(list: readonly AdminVerification[], tab: TabKey): AdminVerification[] {
  return tab === "all" ? [...list] : list.filter((record) => record.status === tab);
}

export function tabCounts(list: readonly AdminVerification[]): Record<TabKey, number> {
  return {
    pending: tabRecords(list, "pending").length,
    approved: tabRecords(list, "approved").length,
    rejected: tabRecords(list, "rejected").length,
    all: list.length,
  };
}
