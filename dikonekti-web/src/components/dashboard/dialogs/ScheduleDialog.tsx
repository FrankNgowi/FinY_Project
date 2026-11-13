"use client";

import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/api-client";
import type { Appointment } from "@/lib/types";
import { AppointmentRow } from "./AppointmentRow";
import { Dialog } from "./Dialog";

const KEY = "appointments/";
export function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const { data, error, mutate } = useSWR(KEY, swrFetcher<Appointment[]>);

  async function decide(id: number, status: "confirmed" | "declined") {
    const updated = await apiFetch<Appointment>(`appointments/${id}/status/`, { method: "PATCH", body: { status } });
    await mutate((current) => current?.map((a) => (a.id === updated.id ? updated : a)), { revalidate: false });
  }

  return (
    <Dialog title="Schedule" onClose={onClose}>
      {error && !data ? (
        <p role="alert" className="rounded-xl bg-warn-soft p-4 text-sm text-orange-900">
          Could not load your schedule. {error instanceof Error ? error.message : ""}
        </p>
      ) : data === undefined ? (
        <p role="status" className="py-6 text-center text-muted">
          Loading schedule…
        </p>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-muted">No appointment requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} onDecide={decide} />
          ))}
        </ul>
      )}
    </Dialog>
  );
}
