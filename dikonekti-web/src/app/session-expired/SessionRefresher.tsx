"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api-client";

/**
 * Shown when Django rejected the access token. Tries the refresh token once (POST) and returns
 * home, or signs the user out. On the `final` pass a refresh already happened and the token was
 * still rejected, so it signs out instead of trying again.
 */
export function SessionRefresher({ final }: { final: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    const options = { method: "POST", redirectOnUnauthorized: false } as const;
    const task = final
      ? apiFetch("auth/logout", options).then(() => "/login", () => "/login")
      : apiFetch("auth/refresh", options).then(() => "/?refreshed=1", () => "/login");
    void task.then((destination) => router.replace(destination));
  }, [final, router]);

  return (
    <p role="status" className="py-12 text-center text-muted">
      Signing you in…
    </p>
  );
}
