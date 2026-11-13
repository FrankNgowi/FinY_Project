export type QuickAction = "profile" | "tips" | "schedule" | "messages";

const ACTIONS: { id: QuickAction; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tips", label: "Health Tips" },
  { id: "schedule", label: "Schedule" },
  { id: "messages", label: "Messages" },
];

export function QuickActions({ onSelect }: { onSelect: (action: QuickAction) => void }) {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="mb-3 text-xl font-bold text-ink">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="rounded-2xl border border-line bg-surface px-4 py-4 text-left text-base font-semibold text-ink hover:border-steel hover:bg-page"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
