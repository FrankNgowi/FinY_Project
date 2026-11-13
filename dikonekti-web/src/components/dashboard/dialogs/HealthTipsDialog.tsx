import { DOCTOR_HEALTH_TIPS } from "@/lib/health-tips";
import { Dialog } from "./Dialog";

export function HealthTipsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Health Tips" onClose={onClose}>
      <ul className="flex flex-col gap-3">
        {DOCTOR_HEALTH_TIPS.map((tip) => (
          <li key={tip} className="rounded-xl bg-page px-4 py-3 text-sm">
            {tip}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
