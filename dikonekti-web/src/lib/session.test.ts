import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  applySessionCookies,
  clearSessionCookies,
  refreshTokens,
} from "./session";

afterEach(() => vi.unstubAllEnvs());

describe("applySessionCookies", () => {
  it("sets_both_cookies_httpOnly_lax_with_matching_lifetimes", () => {
    const res = NextResponse.json({});
    applySessionCookies(res, { access: "a.b.c", refresh: "r.r.r" });
    const access = res.cookies.get(ACCESS_COOKIE);
    const refresh = res.cookies.get(REFRESH_COOKIE);
    expect(access).toMatchObject({ value: "a.b.c", httpOnly: true, sameSite: "lax", path: "/", maxAge: ACCESS_MAX_AGE });
    expect(refresh).toMatchObject({ value: "r.r.r", httpOnly: true, sameSite: "lax", path: "/", maxAge: REFRESH_MAX_AGE });
    expect(ACCESS_MAX_AGE).toBe(12 * 60 * 60);
    expect(REFRESH_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });

  it("marks_cookies_secure_only_in_production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const prod = NextResponse.json({});
    applySessionCookies(prod, { access: "a", refresh: "r" });
    expect(prod.cookies.get(ACCESS_COOKIE)?.secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    const dev = NextResponse.json({});
    applySessionCookies(dev, { access: "a", refresh: "r" });
    expect(dev.cookies.get(ACCESS_COOKIE)?.secure).toBeFalsy();
  });

  it("leaves_the_refresh_cookie_alone_when_no_new_refresh_token_is_given", () => {
    const res = NextResponse.json({});
    applySessionCookies(res, { access: "a" });
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("a");
    expect(res.cookies.get(REFRESH_COOKIE)).toBeUndefined();
  });
});

describe("clearSessionCookies", () => {
  it("expires_both_cookies", () => {
    const res = NextResponse.json({});
    clearSessionCookies(res);
    expect(res.cookies.get(ACCESS_COOKIE)).toMatchObject({ value: "", maxAge: 0, httpOnly: true });
    expect(res.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: "", maxAge: 0, httpOnly: true });
  });
});

describe("refreshTokens", () => {
  const ok = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("posts_the_refresh_token_and_returns_new_tokens", async () => {
    vi.stubEnv("API_BASE_URL", "http://django.test/api");
    const fetchMock = vi.fn().mockResolvedValue(ok({ access: "new-a", refresh: "new-r" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshTokens("old-r")).resolves.toEqual({ access: "new-a", refresh: "new-r" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://django.test/api/auth/refresh/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ refresh: "old-r" });
  });

  it("returns_access_only_when_the_server_does_not_rotate", async () => {
    vi.stubEnv("API_BASE_URL", "http://django.test/api");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ access: "new-a" })));
    await expect(refreshTokens("old-r")).resolves.toEqual({ access: "new-a" });
  });

  it("returns_null_on_401", async () => {
    vi.stubEnv("API_BASE_URL", "http://django.test/api");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ detail: "Token is invalid" }, 401)));
    await expect(refreshTokens("bad")).resolves.toBeNull();
  });

  it("returns_null_on_network_error", async () => {
    vi.stubEnv("API_BASE_URL", "http://django.test/api");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(refreshTokens("r")).resolves.toBeNull();
  });

  it("returns_null_on_malformed_or_incomplete_json", async () => {
    vi.stubEnv("API_BASE_URL", "http://django.test/api");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(refreshTokens("r")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ nothing: true })));
    await expect(refreshTokens("r")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ access: 123 })));
    await expect(refreshTokens("r")).resolves.toBeNull();
  });

  it("returns_null_for_a_blank_refresh_token_without_calling_the_server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(refreshTokens("")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
