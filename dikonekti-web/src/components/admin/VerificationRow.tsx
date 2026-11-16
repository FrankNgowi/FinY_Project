"use client";

import { useState } from "react";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { formatDateTime, initialOf, telHref, timeAgo } from "@/lib/format";
import type { AdminVerification, VerificationStatus } from "@/lib/types";
import { RejectDialog } from "./RejectDialog";
import { DecisionConflictError, decisionErrorMessage } from "./hooks/useVerifications";

const BADGES: Record<VerificationStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-teal-soft text-teal" },
  approved: { label: "Approved", className: "bg-navy text-white" },
  rejected: { label: "Rejected", className: "bg-warn-soft text-orange-900" },
  not_submitted: { label: "Not submitted", className: "bg-page text-muted" },
};

type Props = {
  record: AdminVerification;
  /** Show the status badge (every tab except Pending, where it would say the same thing on every row). */
  showStatus: boolean;
  onApprove: (id: number) => Promise<unknown>;
  onReject: (id: number, reason: string) => Promise<unknown>;
};

const buttonClass =
  "h-10 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60";

export function VerificationRow({ record, showStatus, onApprove, onReject }: Props) {
  const { pending, run } = useSingleFlight();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const name = record.display_name;
  const call = telHref(record.phone_number);
  const badge = BADGES[record.status] ?? BADGES.not_submitted;
  const hasDocument = record.status !== "not_submitted";

  async function approve() {
    setError(null);
    const result = await run(() => onApprove(record.id));
    // A conflict is explained by the list, which stays on screen after the refresh removes this row.
    if (result && !result.ok && !(result.error instanceof DecisionConflictError)) setError(decisionErrorMessage(result.error));
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-steel/15 font-bold text-steel"
        >
          {initialOf(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold break-words text-ink">{name}</p>
            {showStatus && (
              <span data-status={record.status} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-muted">
            {[record.specialization ?? "Specialization not given", record.area ?? "Area unknown"].join(" · ")}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted" title={record.submitted_at ? formatDateTime(record.submitted_at) : undefined}>
          {record.submitted_at ? `Submitted ${timeAgo(record.submitted_at).toLowerCase()}` : "No document yet"}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <p>Username: <span className="font-medium break-all text-ink">{record.username}</span></p>
        {call && record.phone_number && (
          <p>
            Phone:{" "}
            <a href={call} aria-label={`Call ${name}`} className="font-medium text-steel underline underline-offset-2">
              {record.phone_number}
            </a>
          </p>
        )}
        {record.email && <p>Email: <span className="font-medium break-all text-ink">{record.email}</span></p>}
      </div>

      {record.status === "rejected" && record.rejection_reason && (
        <p className="rounded-xl bg-warn-soft p-3 text-sm break-words text-orange-900">Reason: {record.rejection_reason}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasDocument && (
          <a
            href={`/api/admin/verifications/${record.id}/document`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClass} inline-flex items-center border border-line bg-surface text-ink hover:bg-page`}
          >
            View document
          </a>
        )}
        <span className="flex-1" />
        {record.status === "pending" && (
          <>
            <button type="button" disabled={pending} onClick={approve} className={`${buttonClass} bg-navy text-white hover:bg-steel`}>
              Approve
            </button>
            <button type="button" disabled={pending} onClick={() => setRejecting(true)} className={`${buttonClass} border border-danger text-danger hover:bg-page`}>
              Reject
            </button>
          </>
        )}
        {record.status === "approved" && (
          <button type="button" disabled={pending} onClick={() => setRejecting(true)} className={`${buttonClass} border border-danger text-danger hover:bg-page`}>
            Revoke approval
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-orange-900">
          {error}
        </p>
      )}

      {rejecting && (
        <RejectDialog
          doctorName={name}
          submitLabel={record.status === "approved" ? "Revoke approval" : "Reject"}
          onSubmit={(reason) => onReject(record.id, reason)}
          onClose={() => setRejecting(false)}
        />
      )}
    </li>
  );
}
