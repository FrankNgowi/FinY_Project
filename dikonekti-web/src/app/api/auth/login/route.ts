import { NextResponse } from "next/server";
import { loginWithDjango } from "@/lib/auth/django-session";
import { upstreamFailure } from "@/lib/django";
import { LOGIN_BLANK_MESSAGE, loginSchema } from "@/lib/schemas/auth";
import { applySessionCookies } from "@/lib/session";

const json = (message: string, status: number) => NextResponse.json({ message }, { status });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return json(LOGIN_BLANK_MESSAGE, 400);

  let result;
  try {
    result = await loginWithDjango(parsed.data);
  } catch (error) {
    return upstreamFailure("auth/login", error);
  }

  if (result.kind === "rejected") return json(result.message, result.status);
  if (result.kind === "unavailable") return json("Login is unavailable right now. Please try again.", 502);

  const { session } = result;
  const response = NextResponse.json({ role: session.role, display_name: session.displayName });
  applySessionCookies(response, { access: session.access, refresh: session.refresh });
  return response;
}
