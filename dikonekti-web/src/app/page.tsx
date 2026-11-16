import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { ProfileLoadError } from "@/components/ProfileLoadError";
import { decideRoute, unauthorizedRedirect } from "@/lib/route-gate";
import { getServerProfile } from "@/lib/server-profile";

export default async function HomePage(props: PageProps<"/">) {
  const { refreshed } = await props.searchParams;
  const result = await getServerProfile();

  // Cookies cannot be changed while rendering, so a rejected token goes through a route handler
  // that tries the refresh token before signing the user out.
  if (result.status === "unauthorized") redirect(unauthorizedRedirect(refreshed === "1"));

  if (result.status === "error") return <ProfileLoadError />;

  // A profile always exists here, so the decision is never "login". Only an approved doctor gets the dashboard.
  const decision = decideRoute(result.profile);
  if (decision === "unsupported") redirect("/unsupported");
  if (decision === "verification") redirect("/verification");
  if (decision === "admin") redirect("/admin/verifications");
  // Drop the one-time flag from the URL after a successful refresh.
  if (refreshed !== undefined) redirect("/");
  return <Dashboard profile={result.profile} />;
}
