"use client";

import { useRouter } from "next/navigation";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { apiFetch } from "@/lib/api-client";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { pending, run } = useSingleFlight();

  async function logout() {
    const result = await run(
      // Leave even if the request fails: an unreachable server cannot keep the user "logged in" here.
      () => apiFetch("auth/logout", { method: "POST", redirectOnUnauthorized: false }).catch(() => undefined),
      { stayLockedOnSuccess: true },
    );
    if (result) router.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className={`rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-page disabled:opacity-60 ${className}`}
    >
      Log out
    </button>
  );
}
