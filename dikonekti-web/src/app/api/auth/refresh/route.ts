import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, applySessionCookies, clearSessionCookies, refreshTokens } from "@/lib/session";

// POST only: a refresh rotates the session cookies, so it must not be reachable by a plain link.
export async function POST(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const fresh = refresh ? await refreshTokens(refresh) : null;

  if (!fresh) {
    const response = NextResponse.json({ message: "Your session has expired. Please log in again." }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  applySessionCookies(response, fresh);
  return response;
}
