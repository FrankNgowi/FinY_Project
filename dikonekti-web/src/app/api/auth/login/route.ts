import { NextResponse } from "next/server";
import { extractErrorMessage } from "@/lib/api-client";
import { djangoRequest, upstreamFailure } from "@/lib/django";
import { LOGIN_BLANK_MESSAGE, loginSchema } from "@/lib/schemas/auth";
import { applySessionCookies } from "@/lib/session";

const json = (message: string, status: number) => NextResponse.json({ message }, { status });

type LoginPayload = { access?: unknown; refresh?: unknown; profile?: { role?: unknown; display_name?: unknown } };

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return json(LOGIN_BLANK_MESSAGE, 400);

  let upstream: Response;
  try {
    upstream = await djangoRequest("auth/login/", { method: "POST", json: parsed.data });
  } catch (error) {
    return upstreamFailure("auth/login", error);
  }

  const data: unknown = await upstream.json().catch(() => undefined);

  if (upstream.status === 400 || upstream.status === 401) {
    return json(extractErrorMessage(data), upstream.status);
  }
  const payload = data as LoginPayload | undefined;
  if (
    !upstream.ok ||
    typeof payload?.access !== "string" ||
    typeof payload.refresh !== "string" ||
    typeof payload.profile?.role !== "string" ||
    typeof payload.profile.display_name !== "string"
  ) {
    return json("Login is unavailable right now. Please try again.", 502);
  }

  const response = NextResponse.json({
    role: payload.profile.role,
    display_name: payload.profile.display_name,
  });
  applySessionCookies(response, { access: payload.access, refresh: payload.refresh });
  return response;
}
