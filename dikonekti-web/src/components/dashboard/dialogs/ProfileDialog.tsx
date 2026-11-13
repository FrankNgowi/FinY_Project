import { fullName, initialOf } from "@/lib/format";
import type { UserProfile } from "@/lib/types";
import { Dialog } from "./Dialog";
import { InfoRow } from "./InfoRow";

export function ProfileDialog({ profile, onClose }: { profile: UserProfile; onClose: () => void }) {
  const specialization = profile.specialization ?? "General Practice";
  return (
    <Dialog title="Profile" onClose={onClose}>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xl font-bold text-navy"
        >
          {initialOf(fullName(profile))}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold break-words">{profile.display_name}</p>
          <p className="text-sm text-muted">{specialization}</p>
        </div>
      </div>
      <dl className="divide-y divide-line border-t border-line">
        <InfoRow label="Username" value={profile.username} />
        {profile.email && <InfoRow label="Email" value={profile.email} />}
        {profile.phone_number && <InfoRow label="Phone" value={profile.phone_number} />}
        <InfoRow label="Area" value={profile.area ?? "Not specified"} />
        <InfoRow label="Specialization" value={specialization} />
      </dl>
    </Dialog>
  );
}
