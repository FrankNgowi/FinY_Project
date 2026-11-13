import { LogoutButton } from "@/components/dashboard/LogoutButton";

export default function UnsupportedPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-ink">Use the mobile app</h1>
        <p className="mt-3 mb-6 text-muted">
          The web dashboard is for doctors. Please use the Dikonekti mobile app.
        </p>
        <LogoutButton />
      </section>
    </main>
  );
}
