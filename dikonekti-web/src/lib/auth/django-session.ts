import "server-only";
import { extractErrorMessage } from "@/lib/api-client";
import { djangoRequest } from "@/lib/django";
import { extractFieldErrors } from "@/lib/field-errors";
import type { LoginValues, RegisterPayload } from "@/lib/schemas/auth";

export type DjangoSession = { access: string; refresh: string; role: string; displayName: string };

/** Validates the `{access, refresh, profile}` body Django returns from login and register. */
export function parseSessionPayload(data: unknown): DjangoSession | null {
  if (!data || typeof data !== "object") return null;
  const { access, refresh, profile } = data as { access?: unknown; refresh?: unknown; profile?: unknown };
  if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) return null;
  if (!profile || typeof profile !== "object") return null;
  const { role, display_name: displayName } = profile as { role?: unknown; display_name?: unknown };
  if (typeof role !== "string" || typeof displayName !== "string") return null;
  return { access, refresh, role, displayName };
}

export type LoginResult =
  | { kind: "session"; session: DjangoSession }
  | { kind: "rejected"; status: 400 | 401; message: string }
  | { kind: "unavailable" };

/** Network and configuration errors propagate: the route maps them with `upstreamFailure`. */
export async function loginWithDjango(credentials: LoginValues): Promise<LoginResult> {
  const response = await djangoRequest("auth/login/", { method: "POST", json: credentials });
  const data: unknown = await response.json().catch(() => undefined);
  if (response.status === 400 || response.status === 401) {
    return { kind: "rejected", status: response.status, message: extractErrorMessage(data) };
  }
  const session = response.ok ? parseSessionPayload(data) : null;
  return session ? { kind: "session", session } : { kind: "unavailable" };
}

export type RegisterResult =
  | { kind: "session"; session: DjangoSession }
  | { kind: "invalid"; message: string; errors: Record<string, string[]> }
  | { kind: "unavailable" };

/**
 * Web registration is doctor-only: the role is fixed here, never taken from the client, and a
 * response that does not describe a doctor is not accepted as a session.
 */
export async function registerDoctor(payload: RegisterPayload): Promise<RegisterResult> {
  const response = await djangoRequest("auth/register/", { method: "POST", json: { ...payload, role: "doctor" } });
  const data: unknown = await response.json().catch(() => undefined);

  if (response.status === 400) {
    const errors = extractFieldErrors(data);
    const hasFieldErrors = Object.keys(errors).some((key) => key !== "form");
    const message = hasFieldErrors ? "Please fix the highlighted fields." : (errors.form?.[0] ?? "Could not create the account.");
    return { kind: "invalid", message, errors };
  }

  const session = response.status === 201 ? parseSessionPayload(data) : null;
  return session && session.role === "doctor" ? { kind: "session", session } : { kind: "unavailable" };
}
