import { NextResponse, type NextRequest } from "next/server";
import { withCookie } from "@/lib/cookie-header";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  applySessionCookies,
  clearSessionCookies,
  refreshTokens,
  type Tokens,
} from "@/lib/session";

// `isLogin` covers both signed-out pages. Session presence is decided by cookie existence only; Django stays the
// authority and a rejected token ends up at /api/auth/expired.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login" || pathname === "/register"; // pages for signed-out visitors
  const toLogin = () => NextResponse.redirect(new URL("/login", request.url));
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  let fresh: Tokens | null = null;
  if (!access && refresh) {
    // The access cookie expires with the token, so its absence means expiry.
    fresh = await refreshTokens(refresh);
    if (!fresh) {
      const response = isLogin ? NextResponse.next() : toLogin();
      clearSessionCookies(response);
      return response;
    }
  }

  if (!access && !fresh) return isLogin ? NextResponse.next() : toLogin();

  if (isLogin) {
    const response = NextResponse.redirect(new URL("/", request.url));
    if (fresh) applySessionCookies(response, fresh);
    return response;
  }

  if (!fresh) return NextResponse.next();

  // Make the new token visible to the page rendering in this same request.
  const headers = new Headers(request.headers);
  let cookie = withCookie(headers.get("cookie"), ACCESS_COOKIE, fresh.access);
  if (fresh.refresh) cookie = withCookie(cookie, REFRESH_COOKIE, fresh.refresh);
  headers.set("cookie", cookie);
  const response = NextResponse.next({ request: { headers } });
  applySessionCookies(response, fresh);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
