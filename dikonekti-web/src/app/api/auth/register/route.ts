import { NextResponse } from "next/server";
import { registerDoctor } from "@/lib/auth/django-session";
import { upstreamFailure } from "@/lib/django";
import { registerPayloadSchema, zodFieldErrors } from "@/lib/schemas/auth";
import { applySessionCookies } from "@/lib/session";

const fail = (message: string, status: number, errors: Record<string, string[]> = {}) =>
  NextResponse.json({ message, errors }, { status });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Fill in the form to create an account.", 400);
  }
  const parsed = registerPayloadSchema.safeParse(body);
  if (!parsed.success) return fail("Please fix the highlighted fields.", 400, zodFieldErrors(parsed.error));

  let result;
  try {
    result = await registerDoctor(parsed.data);
  } catch (error) {
    return upstreamFailure("auth/register", error);
  }

  if (result.kind === "rejected") return fail(result.message, result.status);
  if (result.kind === "invalid") return fail(result.message, 400, result.errors);
  if (result.kind === "unavailable") return fail("Account creation is unavailable right now. Please try again.", 502);

  const { session } = result;
  const response = NextResponse.json({ role: session.role, display_name: session.displayName }, { status: 201 });
  applySessionCookies(response, { access: session.access, refresh: session.refresh });
  return response;
}
