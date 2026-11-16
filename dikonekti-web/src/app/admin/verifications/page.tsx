import { redirect } from "next/navigation";
import { VerificationList } from "@/components/admin/VerificationList";
import { BrandHeader } from "@/components/BrandHeader";
import { LogoutButton } from "@/components/LogoutButton";
import { ProfileLoadError } from "@/components/ProfileLoadError";
import { decideRoute, unauthorizedRedirect } from "@/lib/route-gate";
import { getServerProfile } from "@/lib/server-profile";

export default async function AdminVerificationsPage() {
  const result = await getServerProfile();
  if (result.status === "unauthorized") redirect(unauthorizedRedirect(false));
  if (result.status === "error") return <ProfileLoadError />;

  // Only an admin belongs here; the home page sends everyone else where they belong. Django still
  // answers 403 to every admin call from any other role, so this is the screen choice, not the lock.
  if (decideRoute(result.profile) !== "admin") redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-ink">Doctor verification</h1>
          <LogoutButton />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        <BrandHeader homeHref="/" />
        <p className="text-center text-sm text-muted">
          Signed in as <span className="font-medium text-ink">{result.profile.display_name}</span>
        </p>
        <VerificationList />
      </main>
    </div>
  );
}
