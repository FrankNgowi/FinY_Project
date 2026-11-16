"use client";

import { useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CONFLICT_MESSAGE, DecisionConflictError, useDecisions, useVerifications } from "./hooks/useVerifications";
import { TABS, tabCounts, tabRecords, type TabKey } from "./tabs";
import { VerificationRow } from "./VerificationRow";

const EMPTY: Record<TabKey, string> = {
  pending: "Nothing waiting for review.",
  approved: "No approved doctors yet.",
  rejected: "No rejected requests.",
  all: "No doctors have registered yet.",
};

export function VerificationList() {
  const { data, error, mutate } = useVerifications();
  const decisions = useDecisions();
  const [tab, setTab] = useState<TabKey>("pending");
  // The refresh after a conflict removes the row that raised it, so the message lives here instead.
  const [notice, setNotice] = useState<string | null>(null);

  function watched<A extends unknown[]>(decide: (...args: A) => Promise<unknown>) {
    return async (...args: A) => {
      try {
        const result = await decide(...args);
        setNotice(null);
        return result;
      } catch (error) {
        if (error instanceof DecisionConflictError) setNotice(CONFLICT_MESSAGE);
        throw error;
      }
    };
  }

  const counts = data ? tabCounts(data) : null;
  const records = data ? tabRecords(data, tab) : [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <ErrorBanner
          message={`Could not load the review list. ${error instanceof Error ? error.message : ""}`.trim()}
          onRetry={() => void mutate()}
        />
      )}

      {notice && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl bg-warn-soft p-4 text-sm text-orange-900">
          <p className="flex-1">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-semibold underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}

      {!data && !error && (
        <p role="status" className="py-12 text-center text-muted">
          Loading doctors…
        </p>
      )}

      {data && counts && (
        <>
          <div role="tablist" aria-label="Review status" className="flex flex-wrap gap-2">
            {TABS.map(({ key, label }) => {
              const selected = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={selected}
                  aria-controls="review-panel"
                  onClick={() => setTab(key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected ? "bg-navy text-white" : "border border-line bg-surface text-ink hover:bg-page"
                  }`}
                >
                  {label} ({counts[key]})
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id="review-panel" aria-labelledby={`tab-${tab}`}>
            {records.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface p-5 text-muted">{EMPTY[tab]}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {records.map((record) => (
                  <VerificationRow
                    key={record.id}
                    record={record}
                    showStatus={tab !== "pending"}
                    onApprove={watched(decisions.approve)}
                    onReject={watched(decisions.reject)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
