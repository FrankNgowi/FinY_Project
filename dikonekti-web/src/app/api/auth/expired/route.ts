import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, applySessionCookies, clearSessionCookies, refreshTokens } from "@/lib/session";

// Landing point for server components that find the session rejected. Cookies cannot be changed
// while rendering, so they redirect here: try the refresh token once, and only sign the user out
// if that fails (or this is already the final pass after a refresh).
export async function GET(request: NextRequest) {
  const final = request.nextUrl.searchParams.get("final") === "1";
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!final && refresh) {
    const fresh = await refreshTokens(refresh);
    if (fresh) {
      const response = NextResponse.redirect(new URL("/?refreshed=1", request.url));
      applySessionCookies(response, fresh);
      return response;
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookies(response);
  return response;
}
