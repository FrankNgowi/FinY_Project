import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const req = (cookie: string, query = "") =>
  new NextRequest(`http://web.test/api/auth/expired${query}`, { headers: cookie ? { cookie } : {} });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const path = (res: Response) => {
  const url = new URL(res.headers.get("location")!);
  return url.pathname + url.search;
};
const allCleared = (res: Response) => res.headers.getSetCookie().length === 2 && res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c));

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/auth/expired", () => {
  it("clears_cookies_and_goes_to_login_when_there_is_no_refresh_token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req("dik_access=stale"));
    expect(res.status).toBe(307);
    expect(path(res)).toBe("/login");
    expect(allCleared(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes_a_rejected_session_and_returns_home_instead_of_logging_out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ access: "NEW", refresh: "R2" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req("dik_access=stale; dik_refresh=REF"));
    expect(path(res)).toBe("/?refreshed=1");
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/dik_access=NEW/);
    expect(setCookie).toMatch(/dik_refresh=R2/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh: "REF" });
  });

  it("clears_cookies_and_goes_to_login_when_the_refresh_is_rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "bad" }, 401)));
    const res = await GET(req("dik_access=stale; dik_refresh=BAD"));
    expect(path(res)).toBe("/login");
    expect(allCleared(res)).toBe(true);
  });

  it("never_refreshes_again_on_the_final_pass_so_a_bad_token_cannot_loop", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req("dik_access=stale; dik_refresh=REF", "?final=1"));
    expect(path(res)).toBe("/login");
    expect(allCleared(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores_unrelated_query_values_for_final", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ access: "NEW" })));
    const res = await GET(req("dik_refresh=REF", "?final=0"));
    expect(path(res)).toBe("/?refreshed=1");
  });
});
