"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatDateTime } from "@/lib/format";
import type { VerificationRecord } from "@/lib/types";
import { UploadForm } from "./UploadForm";
import { useVerification } from "./hooks/useVerification";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="verification-heading" className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="verification-heading" className="text-xl font-bold text-ink">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function StatusCard({ record, onRetry }: { record: VerificationRecord; onRetry: () => void }) {
  switch (record.status) {
    case "not_submitted":
      return (
        <Card title="Upload your confirmation letter or certificate">
          <p className="text-sm text-muted">We check it before you can see patients and alerts.</p>
          <UploadForm submitLabel="Submit for review" />
        </Card>
      );
    case "pending":
      return (
        <Card title="Your document is under review">
          <p className="rounded-xl bg-teal-soft p-4 text-sm text-ink">
            {record.submitted_at ? `Submitted ${formatDateTime(record.submitted_at, "en-GB")}. ` : ""}
            We will unlock your dashboard once it is approved.
          </p>
          <p className="text-xs text-muted">This page checks every 30 seconds and moves on by itself.</p>
        </Card>
      );
    case "rejected":
      return (
        <Card title="Your document was not accepted">
          <p className="rounded-xl bg-warn-soft p-4 text-sm break-words text-orange-900">
            Reason: {record.rejection_reason}
          </p>
          <UploadForm submitLabel="Submit again" />
        </Card>
      );
    case "approved":
      return (
        <p role="status" className="py-8 text-center text-muted">
          Approved. Opening your dashboard…
        </p>
      );
    default:
      // A status this app does not know must never read as an approval.
      return <ErrorBanner message="We could not read your verification status." onRetry={onRetry} />;
  }
}

export function VerificationPanel() {
  const router = useRouter();
  const { data, error, mutate } = useVerification();
  const approved = data?.status === "approved";

  // The server re-checks the profile on "/", so a stale page can never show the dashboard early.
  useEffect(() => {
    if (approved) router.replace("/");
  }, [approved, router]);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <ErrorBanner
          message={`Could not load your verification status. ${error instanceof Error ? error.message : ""}`.trim()}
          onRetry={() => void mutate()}
        />
      )}
      {data ? (
        <StatusCard record={data} onRetry={() => void mutate()} />
      ) : (
        !error && (
          <p role="status" className="py-12 text-center text-muted">
            Checking your document status…
          </p>
        )
      )}
    </div>
  );
}
