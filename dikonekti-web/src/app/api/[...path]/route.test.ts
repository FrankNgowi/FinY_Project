import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./route";

type Handler = typeof GET;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function call(
  handler: Handler,
  path: string[],
  init: { method?: string; cookie?: string; headers?: Record<string, string>; body?: string; query?: string } = {},
) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  const url = `http://web.test/api/${path.join("/")}${init.query ?? ""}`;
  const request = new NextRequest(url, { method: init.method ?? "GET", headers, body: init.body });
  return handler(request, { params: Promise.resolve({ path }) });
}

const cookie = (access?: string, refresh?: string) =>
  [access && `dik_access=${access}`, refresh && `dik_refresh=${refresh}`].filter(Boolean).join("; ");

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("API proxy", () => {
  it("returns_401_without_calling_django_when_there_are_no_cookies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["alerts"]);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards_the_bearer_token_and_returns_the_body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([{ id: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["alerts"], { cookie: cookie("ACC", "REF") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://django.test/api/alerts/");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer ACC");
  });

  it("does_not_forward_client_authorization_or_cookie_headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", fetchMock);
    await call(GET, ["alerts"], {
      cookie: cookie("ACC", "REF"),
      headers: { authorization: "Bearer ATTACKER", "x-forwarded-for": "1.2.3.4" },
    });
    const sent = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(sent.get("authorization")).toBe("Bearer ACC");
    expect(sent.get("cookie")).toBeNull();
    expect(sent.get("x-forwarded-for")).toBeNull();
  });

  it("refreshes_once_after_a_401_then_retries_and_sets_new_cookies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ access: "NEW", refresh: "NEWREF" }))
      .mockResolvedValueOnce(json([{ id: 2 }]));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["alerts"], { cookie: cookie("OLD", "REF") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("authorization")).toBe("Bearer NEW");
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/dik_access=NEW/);
    expect(setCookie).toMatch(/dik_refresh=NEWREF/);
  });

  it("does_not_loop_when_the_retry_is_also_401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ access: "NEW" }))
      .mockResolvedValueOnce(json({ detail: "still no" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["alerts"], { cookie: cookie("OLD", "REF") });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c))).toBe(true);
  });

  it("clears_cookies_and_returns_401_when_the_refresh_fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ detail: "expired" }, 401))
      .mockResolvedValueOnce(json({ detail: "bad refresh" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["alerts"], { cookie: cookie("OLD", "REF") });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c))).toBe(true);
  });

  it("refreshes_first_when_only_the_refresh_cookie_exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ access: "NEW", refresh: "R2" }))
      .mockResolvedValueOnce(json({ username: "dr1" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["me"], { cookie: cookie(undefined, "REF") });
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/auth/refresh/");
    expect(res.headers.getSetCookie().join("\n")).toMatch(/dik_access=NEW/);
  });

  it("does_not_retry_a_401_when_there_is_no_refresh_cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ detail: "expired" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(GET, ["alerts"], { cookie: cookie("OLD") });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.headers.getSetCookie().every((c) => /Max-Age=0/i.test(c))).toBe(true);
  });

  it.each([
    [GET, ["auth", "login"], "GET"],
    [GET, ["auth", "refresh"], "GET"],
    [POST, ["auth", "login"], "POST"],
    [GET, ["alerts", "..", "auth", "login"], "GET"],
    [GET, ["doctors"], "GET"],
    [POST, ["alerts"], "POST"],
    [PATCH, ["alerts", "abc", "acknowledge"], "PATCH"],
  ] as const)("returns_404_without_calling_django_for_%o %j", async (handler, path, method) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(handler, [...path], { method, cookie: cookie("ACC", "REF"), body: method === "GET" ? undefined : "{}" });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards_the_patient_query_only_for_messages", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json([]));
    vi.stubGlobal("fetch", fetchMock);
    await call(GET, ["messages"], { cookie: cookie("ACC"), query: "?patient=p%201&evil=1" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/messages/?patient=p%201");
    await call(GET, ["alerts"], { cookie: cookie("ACC"), query: "?patient=p1&evil=1" });
    expect(fetchMock.mock.calls[1][0]).toBe("http://django.test/api/alerts/");
  });

  it("forwards_json_bodies_for_post_and_patch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 9 }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({ body: "hi", recipient_username: "p1" });
    const res = await call(POST, ["messages"], { method: "POST", cookie: cookie("ACC"), body, headers: { "content-type": "application/json" } });
    expect(res.status).toBe(201);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("passes_through_upstream_4xx_json_errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "You do not have permission." }, 403)));
    const res = await call(PATCH, ["alerts", "5", "acknowledge"], { method: "PATCH", cookie: cookie("ACC"), body: "{}" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ detail: "You do not have permission." });
  });

  it("replaces_a_non_json_upstream_error_page_with_a_generic_message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Traceback secret</html>", { status: 500, headers: { "content-type": "text/html" } })));
    const res = await call(GET, ["alerts"], { cookie: cookie("ACC") });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("Traceback");
  });

  it("returns_502_when_django_is_unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const res = await call(GET, ["alerts"], { cookie: cookie("ACC") });
    expect(res.status).toBe(502);
  });

  it("reports_a_missing_API_BASE_URL_as_a_500_configuration_error_and_logs_it", async () => {
    vi.stubEnv("API_BASE_URL", "");
    vi.stubGlobal("fetch", vi.fn());
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(GET, ["alerts"], { cookie: cookie("ACC", "REF") });
    expect(res.status).toBe(500);
    expect((await res.json()).message).toMatch(/not configured/i);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("API_BASE_URL"));
  });
});
