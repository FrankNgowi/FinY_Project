import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const req = (path: string, cookie = "") =>
  new NextRequest(`http://web.test${path}`, { headers: cookie ? { cookie } : {} });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const isRedirectTo = (res: Response, path: string) =>
  res.status >= 300 && res.status < 400 && new URL(res.headers.get("location")!).pathname === path;

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("redirects_to_login_when_there_are_no_cookies", async () => {
    const res = await proxy(req("/"));
    expect(isRedirectTo(res, "/login")).toBe(true);
  });

  it("lets_an_anonymous_visitor_see_the_login_page", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("redirects_a_logged_in_visitor_away_from_login", async () => {
    const res = await proxy(req("/login", "dik_access=A; dik_refresh=R"));
    expect(isRedirectTo(res, "/")).toBe(true);
  });

  it("lets_a_logged_in_visitor_through", async () => {
    const res = await proxy(req("/", "dik_access=A; dik_refresh=R"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("refreshes_when_only_the_refresh_cookie_remains_and_sets_new_cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ access: "NEW", refresh: "R2" })));
    const res = await proxy(req("/", "dik_refresh=R"));
    expect(res.headers.get("location")).toBeNull();
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/dik_access=NEW/);
    expect(setCookie).toMatch(/dik_refresh=R2/);
    // The refreshed token must be visible to the page in the same request.
    expect(res.headers.get("x-middleware-request-cookie") ?? "").toContain("dik_access=NEW");
  });

  it("redirects_and_clears_cookies_when_the_refresh_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "bad" }, 401)));
    const res = await proxy(req("/", "dik_refresh=BAD"));
    expect(isRedirectTo(res, "/login")).toBe(true);
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c))).toBe(true);
  });

  it("shows_login_instead_of_looping_when_the_refresh_fails_on_the_login_page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "bad" }, 401)));
    const res = await proxy(req("/login", "dik_refresh=BAD"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c))).toBe(true);
  });

  it("protects_the_unsupported_page_too", async () => {
    const res = await proxy(req("/unsupported"));
    expect(isRedirectTo(res, "/login")).toBe(true);
  });
});

describe("proxy /register", () => {
  it("lets_an_anonymous_visitor_see_the_register_page", async () => {
    const res = await proxy(req("/register"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("redirects_a_logged_in_visitor_away_from_register", async () => {
    const res = await proxy(req("/register", "dik_access=A; dik_refresh=R"));
    expect(isRedirectTo(res, "/")).toBe(true);
  });

  it("shows_register_instead_of_looping_when_the_refresh_fails_there", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "bad" }, 401)));
    const res = await proxy(req("/register", "dik_refresh=BAD"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c))).toBe(true);
  });
});
