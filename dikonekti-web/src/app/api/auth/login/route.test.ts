import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const login = (body: unknown) =>
  new Request("http://web.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const upstream = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const profile = (role: string) => ({ username: "dr1", role, display_name: "Dr. Jane Doe" });

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/login", () => {
  it("sets_two_httpOnly_cookies_and_never_returns_tokens_for_a_doctor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ access: "ACC", refresh: "REF", profile: profile("doctor") })));
    const res = await POST(login({ username: "dr1", password: "pw" }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ role: "doctor", display_name: "Dr. Jane Doe" });
    expect(text).not.toContain("ACC");
    expect(text).not.toContain("REF");
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/dik_access=ACC/);
    expect(setCookie).toMatch(/dik_refresh=REF/);
    expect(res.headers.getSetCookie().every((c) => /HttpOnly/i.test(c))).toBe(true);
  });

  it("also_sets_cookies_for_a_disabled_user_so_logout_works", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ access: "A", refresh: "R", profile: profile("disabled") })));
    const res = await POST(login({ username: "p1", password: "pw" }));
    expect(await res.json()).toEqual({ role: "disabled", display_name: "Dr. Jane Doe" });
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it("forwards_django_credentials_error_and_sets_no_cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ detail: "No active account found with the given credentials" }, 401)));
    const res = await POST(login({ username: "dr1", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "No active account found with the given credentials" });
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it.each([
    [{ username: "", password: "pw" }],
    [{ username: "dr1", password: "" }],
    [{ username: "   ", password: "pw" }],
    [{ username: "dr1" }],
    [{ password: "pw" }],
    [{ username: 5, password: {} }],
    [{}],
    ["not json"],
    ["null"],
    ["[]"],
  ])("rejects_invalid_input_%j_without_calling_django", async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(login(body));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toEqual(expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns_502_when_django_is_down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const res = await POST(login({ username: "dr1", password: "pw" }));
    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("returns_502_without_leaking_an_upstream_html_error_page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Traceback secret</html>", { status: 500 })));
    const res = await POST(login({ username: "dr1", password: "pw" }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("Traceback");
  });

  it("returns_502_when_a_200_response_is_missing_tokens_or_profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ access: "A" })));
    const res = await POST(login({ username: "dr1", password: "pw" }));
    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("sends_credentials_only_to_the_django_login_endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream({ access: "A", refresh: "R", profile: profile("doctor") }));
    vi.stubGlobal("fetch", fetchMock);
    await POST(login({ username: " dr1 ", password: " pw ", role: "doctor", extra: "x" }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://django.test/api/auth/login/");
    expect(JSON.parse(init.body)).toEqual({ username: "dr1", password: " pw " });
  });

  it("reports_a_missing_API_BASE_URL_as_a_server_configuration_error_and_logs_why", async () => {
    vi.stubEnv("API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(login({ username: "dr1", password: "pw" }));
    expect(res.status).toBe(500);
    expect((await res.json()).message).toMatch(/not configured/i);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("API_BASE_URL"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("passes_a_429_through_with_the_fixed_message_and_sets_no_cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Request was throttled. Expected available in 42 seconds." }), { status: 429 })));
    const res = await POST(login({ username: "dr1", password: "pw" }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ message: "Too many attempts. Please wait a few minutes and try again." });
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});
