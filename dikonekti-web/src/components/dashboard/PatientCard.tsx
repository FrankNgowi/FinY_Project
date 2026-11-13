import { fullName, initialOf, telHref } from "@/lib/format";
import type { UserProfile } from "@/lib/types";

export function PatientCard({ patient }: { patient: UserProfile }) {
  const name = fullName(patient);
  const call = telHref(patient.phone_number);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-steel/15 font-bold text-steel"
      >
        {initialOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink break-words">{name}</p>
        <p className="text-sm text-muted">
          {patient.disability_type ?? "Not specified"} · {patient.area ?? "Area unknown"}
        </p>
      </div>
      {call && (
        <a
          href={call}
          aria-label={`Call ${name}`}
          className="shrink-0 rounded-full bg-teal-soft px-3 py-2 text-sm font-semibold text-teal"
        >
          Call
        </a>
      )}
    </li>
  );
}
