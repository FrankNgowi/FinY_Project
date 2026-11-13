import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const post = (cookie: string) =>
  new NextRequest("http://web.test/api/auth/refresh", { method: "POST", headers: cookie ? { cookie } : {} });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const allCleared = (res: Response) => res.headers.getSetCookie().length === 2 && res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c));

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/refresh", () => {
  it("only_responds_to_POST_so_a_cross_site_link_cannot_change_the_session", () => {
    expect(Object.keys(route).filter((k) => ["GET", "HEAD", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([]);
    expect(typeof route.POST).toBe("function");
  });

  it("refreshes_the_session_and_sets_new_httpOnly_cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ access: "NEW", refresh: "R2" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post("dik_access=stale; dik_refresh=REF"));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    expect(cookies.join("\n")).toMatch(/dik_access=NEW/);
    expect(cookies.join("\n")).toMatch(/dik_refresh=R2/);
    expect(cookies.every((c) => /HttpOnly/i.test(c))).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh: "REF" });
    expect(await res.text()).not.toContain("NEW");
  });

  it("clears_the_session_and_returns_401_when_the_refresh_token_is_rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "bad" }, 401)));
    const res = await route.POST(post("dik_access=stale; dik_refresh=BAD"));
    expect(res.status).toBe(401);
    expect(allCleared(res)).toBe(true);
  });

  it("clears_the_session_without_calling_django_when_there_is_no_refresh_token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.POST(post("dik_access=stale"));
    expect(res.status).toBe(401);
    expect(allCleared(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
