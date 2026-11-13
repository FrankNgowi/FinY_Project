"use client";

import { useState } from "react";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { telHref, timeAgo } from "@/lib/format";
import type { EmergencyAlert } from "@/lib/types";
import { AlertLocation } from "./AlertLocation";
import { useNow } from "./hooks/useNow";

type Props = { alert: EmergencyAlert; onAcknowledge: (id: number) => Promise<void> };

export function AlertCard({ alert, onAcknowledge }: Props) {
  const now = useNow();
  const { pending, run } = useSingleFlight();
  const [error, setError] = useState<string | null>(null);

  const active = !alert.acknowledged;
  const call = telHref(alert.patient_phone_number);
  const meta = [alert.disability_type, alert.patient_area].filter(Boolean).join(" · ");

  async function acknowledge() {
    setError(null);
    const result = await run(() => onAcknowledge(alert.id));
    if (result && !result.ok) setError(result.error instanceof Error ? result.error.message : "Please try again.");
  }

  return (
    <article
      className={`rounded-2xl border border-line border-l-[5px] bg-surface p-4 ${
        active ? "border-l-danger shadow-md shadow-danger/10" : "border-l-teal"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-ink break-words">{alert.patient_name}</h3>
          <p className={`text-sm ${active ? "font-semibold text-danger" : "text-muted"}`}>
            {active ? "Needs urgent help" : "Marked resolved"} <span className="whitespace-nowrap">· {timeAgo(alert.timestamp, now)}</span>
          </p>
        </div>
        {active && (
          <button
            type="button"
            onClick={acknowledge}
            disabled={pending}
            aria-label={`Acknowledge alert from ${alert.patient_name}`}
            className="shrink-0 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-navy disabled:opacity-60"
          >
            {pending ? "Acknowledging…" : "Acknowledge"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-orange-900">
          Could not acknowledge: {error}
        </p>
      )}

      {meta && (
        <p data-testid="alert-meta" className="mt-2 text-xs text-muted">
          {meta}
        </p>
      )}

      {call && (
        <a
          href={call}
          aria-label={`Call ${alert.patient_name}`}
          className="mt-3 inline-block rounded-full bg-teal-soft px-3 py-1.5 text-xs font-semibold text-teal"
        >
          {alert.patient_phone_number?.trim()}
        </a>
      )}

      <div className="mt-3">
        <AlertLocation alert={alert} />
      </div>
    </article>
  );
}
