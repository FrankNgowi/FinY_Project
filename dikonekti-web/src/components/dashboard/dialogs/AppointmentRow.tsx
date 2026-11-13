"use client";

import { useState } from "react";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { formatDateTime } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const LABELS: Record<AppointmentStatus, string> = { pending: "Pending", confirmed: "Confirmed", declined: "Declined" };
const TONES: Record<AppointmentStatus, string> = {
  pending: "bg-warn-soft text-orange-900",
  confirmed: "bg-teal-soft text-teal",
  declined: "bg-red-50 text-danger",
};

export function AppointmentRow({
  appointment,
  onDecide,
}: {
  appointment: Appointment;
  onDecide: (id: number, status: "confirmed" | "declined") => Promise<void>;
}) {
  const { pending, run } = useSingleFlight();
  const [error, setError] = useState<string | null>(null);

  async function decide(status: "confirmed" | "declined") {
    setError(null);
    const result = await run(() => onDecide(appointment.id, status));
    if (result && !result.ok) setError(result.error instanceof Error ? result.error.message : "Please try again.");
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold break-words">{appointment.patient_name}</p>
          <p className="text-sm text-muted">{formatDateTime(appointment.requested_time)}</p>
          {appointment.reason && <p className="mt-1 text-sm break-words">{appointment.reason}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${TONES[appointment.status]}`}>
          {LABELS[appointment.status]}
        </span>
      </div>
      {appointment.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("declined")}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-page disabled:opacity-60"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide("confirmed")}
            className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-steel disabled:opacity-60"
          >
            Confirm
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-orange-900">
          {error}
        </p>
      )}
    </li>
  );
}
