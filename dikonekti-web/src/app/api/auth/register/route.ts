import { NextResponse } from "next/server";
import { djangoRequest, upstreamFailure } from "@/lib/django";
import { extractFieldErrors } from "@/lib/field-errors";
import { registerPayloadSchema, zodFieldErrors } from "@/lib/schemas/auth";
import { applySessionCookies } from "@/lib/session";

const fail = (message: string, status: number, errors: Record<string, string[]> = {}) =>
  NextResponse.json({ message, errors }, { status });

type Created = { access?: unknown; refresh?: unknown; profile?: { role?: unknown; display_name?: unknown } };

// Web registration is for doctors only. The schema drops every field it does not list, and the
// role is fixed here, never taken from the client.
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Fill in the form to create an account.", 400);
  }
  const parsed = registerPayloadSchema.safeParse(body);
  if (!parsed.success) return fail("Please fix the highlighted fields.", 400, zodFieldErrors(parsed.error));

  let upstream: Response;
  try {
    upstream = await djangoRequest("auth/register/", { method: "POST", json: { ...parsed.data, role: "doctor" } });
  } catch (error) {
    return upstreamFailure("auth/register", error);
  }

  const data: unknown = await upstream.json().catch(() => undefined);

  if (upstream.status === 400) {
    const fieldErrors = extractFieldErrors(data);
    const hasFieldErrors = Object.keys(fieldErrors).some((key) => key !== "form");
    const message = hasFieldErrors ? "Please fix the highlighted fields." : (fieldErrors.form?.[0] ?? "Could not create the account.");
    return fail(message, 400, fieldErrors);
  }

  const created = data as Created | undefined;
  if (
    upstream.status !== 201 ||
    typeof created?.access !== "string" ||
    typeof created.refresh !== "string" ||
    created.profile?.role !== "doctor" ||
    typeof created.profile.display_name !== "string"
  ) {
    return fail("Account creation is unavailable right now. Please try again.", 502);
  }

  const response = NextResponse.json({ role: "doctor", display_name: created.profile.display_name }, { status: 201 });
  applySessionCookies(response, { access: created.access, refresh: created.refresh });
  return response;
}
