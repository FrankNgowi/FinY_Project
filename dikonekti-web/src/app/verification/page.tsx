import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { LogoutButton } from "@/components/LogoutButton";
import { ProfileLoadError } from "@/components/ProfileLoadError";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { decideRoute, unauthorizedRedirect } from "@/lib/route-gate";
import { getServerProfile } from "@/lib/server-profile";

export default async function VerificationPage() {
  const result = await getServerProfile();
  if (result.status === "unauthorized") redirect(unauthorizedRedirect(false));
  if (result.status === "error") return <ProfileLoadError />;

  // Only a doctor who is not approved belongs here. The home page sends everyone else where they belong:
  // an approved doctor to the dashboard, any other role to the "use the mobile app" page.
  if (decideRoute(result.profile) !== "verification") redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-ink">Verification</h1>
          <LogoutButton />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <BrandHeader homeHref="/" />
        <p className="text-center text-sm text-muted">
          Signed in as <span className="font-medium text-ink">{result.profile.display_name}</span>
        </p>
        <VerificationPanel />
      </main>
    </div>
  );
}
