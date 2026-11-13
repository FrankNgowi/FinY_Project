import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { RetryButton } from "@/components/RetryButton";
import { decideRoute, unauthorizedRedirect } from "@/lib/route-gate";
import { getServerProfile } from "@/lib/server-profile";

export default async function HomePage(props: PageProps<"/">) {
  const { refreshed } = await props.searchParams;
  const result = await getServerProfile();

  // Cookies cannot be changed while rendering, so a rejected token goes through a route handler
  // that tries the refresh token before signing the user out.
  if (result.status === "unauthorized") redirect(unauthorizedRedirect(refreshed === "1"));

  if (result.status === "error") {
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

  // A profile always exists here, so decideRoute only returns "dashboard" or "unsupported".
  if (decideRoute(result.profile) === "unsupported") redirect("/unsupported");
  // Drop the one-time flag from the URL after a successful refresh.
  if (refreshed !== undefined) redirect("/");
  return <Dashboard profile={result.profile} />;
}
