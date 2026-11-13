export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 text-sm">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{value}</dd>
    </div>
  );
}
