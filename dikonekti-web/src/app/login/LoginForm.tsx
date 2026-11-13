"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { apiFetch } from "@/lib/api-client";
import { LOGIN_BLANK_MESSAGE, loginSchema, type LoginValues } from "@/lib/schemas/auth";

const inputClass = "h-11 rounded-xl border border-line bg-surface px-3 text-base font-normal";

export function LoginForm() {
  const router = useRouter();
  const { register, handleSubmit } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const { pending, run } = useSingleFlight();
  const [error, setError] = useState<string | null>(null);

  async function onValid(values: LoginValues) {
    setError(null);
    const result = await run(() => apiFetch("auth/login", { method: "POST", body: values, redirectOnUnauthorized: false }), {
      stayLockedOnSuccess: true,
    });
    if (!result) return;
    if (result.ok) {
      // The dashboard page decides between the dashboard and the mobile-app notice.
      router.replace("/");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid, () => setError(LOGIN_BLANK_MESSAGE))} noValidate className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-orange-900">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Username
        <input {...register("username")} autoComplete="username" autoCapitalize="none" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        Password
        <input {...register("password")} type="password" autoComplete="current-password" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-navy px-4 text-base font-semibold text-white transition-colors hover:bg-steel disabled:opacity-60"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
