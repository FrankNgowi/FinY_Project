export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-2xl bg-warn-soft p-4 text-sm text-orange-900">
      <p className="flex-1">{message}</p>
      <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
        Retry
      </button>
    </div>
  );
}
