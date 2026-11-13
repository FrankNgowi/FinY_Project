"use client";

import { useState } from "react";
import { fullName, initialOf } from "@/lib/format";
import type { UserProfile } from "@/lib/types";
import { Dialog } from "./Dialog";
import { MessageThread } from "./MessageThread";

type Props = { currentUsername: string; /** undefined while loading or when the list could not be loaded. */ patients: UserProfile[] | undefined; onClose: () => void };

export function MessagesDialog({ currentUsername, patients, onClose }: Props) {
  const [selected, setSelected] = useState<UserProfile | null>(null);

  return (
    <Dialog title="Messages" onClose={onClose}>
      {selected ? (
        <MessageThread patient={selected} currentUsername={currentUsername} onBack={() => setSelected(null)} />
      ) : patients === undefined ? (
        <p className="py-6 text-center text-muted">Patients are unavailable right now. Close this and try again in a moment.</p>
      ) : patients.length === 0 ? (
        <p className="py-6 text-center text-muted">No patients to message yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {patients.map((patient) => (
            <li key={patient.username}>
              <button
                type="button"
                onClick={() => setSelected(patient)}
                className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-page"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-steel/15 font-bold text-steel"
                >
                  {initialOf(fullName(patient))}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold break-words">{fullName(patient)}</span>
                  <span className="block text-sm text-muted">{patient.area ?? "Area unknown"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
