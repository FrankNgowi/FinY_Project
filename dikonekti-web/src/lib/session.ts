import "server-only";
import type { NextResponse } from "next/server";
import { djangoRequest } from "./django";

export const ACCESS_COOKIE = "dik_access";
export const REFRESH_COOKIE = "dik_refresh";

// Match Django SIMPLE_JWT: ACCESS 12h, REFRESH 30d.
export const ACCESS_MAX_AGE = 12 * 60 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export type Tokens = { access: string; refresh?: string };

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function applySessionCookies(response: NextResponse, tokens: Tokens): void {
  response.cookies.set(ACCESS_COOKIE, tokens.access, cookieOptions(ACCESS_MAX_AGE));
  if (tokens.refresh) {
    response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(REFRESH_MAX_AGE));
  }
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}

/** Exchanges a refresh token for new tokens. Returns null on any failure. */
export async function refreshTokens(refresh: string): Promise<Tokens | null> {
  if (!refresh) return null;
  try {
    const response = await djangoRequest("auth/refresh/", { method: "POST", json: { refresh }, timeoutMs: 10_000 });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const { access, refresh: rotated } = data as { access?: unknown; refresh?: unknown };
    if (typeof access !== "string" || !access) return null;
    return typeof rotated === "string" && rotated ? { access, refresh: rotated } : { access };
  } catch {
    return null;
  }
}
