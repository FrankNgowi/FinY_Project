import { RetryButton } from "@/components/RetryButton";

/** Shown by a server page when Django could not be reached for the signed-in user's profile. */
export function ProfileLoadError() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-ink">Could not load your account</h1>
        <p className="mt-3 mb-6 text-muted">The server did not respond. Please try again.</p>
        <RetryButton />
      </section>
    </main>
  );
}
