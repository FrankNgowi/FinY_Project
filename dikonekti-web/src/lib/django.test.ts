import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError, djangoRequest, upstreamFailure } from "./django";

const ok = () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("djangoRequest", () => {
  it("calls_the_base_url_with_json_headers_no_store_and_a_timeout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await djangoRequest("auth/login/", { method: "POST", json: { a: 1 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://django.test/api/auth/login/");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("authorization")).toBeNull();
  });

  it("adds_the_bearer_token_when_given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await djangoRequest("me/", { token: "ACC" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer ACC");
    expect(new Headers(init.headers).get("content-type")).toBeNull();
  });

  it("passes_a_raw_body_with_its_own_content_type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);
    await djangoRequest("messages/", { method: "POST", token: "A", body: "{}", contentType: "application/json; charset=utf-8" });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("content-type")).toBe("application/json; charset=utf-8");
    expect(fetchMock.mock.calls[0][1].body).toBe("{}");
  });

  it("honours_a_custom_timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
    const spy = vi.spyOn(AbortSignal, "timeout");
    await djangoRequest("me/", { timeoutMs: 1234 });
    expect(spy).toHaveBeenCalledWith(1234);
  });

  it("throws_ConfigError_without_calling_fetch_when_API_BASE_URL_is_missing", async () => {
    vi.stubEnv("API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(djangoRequest("me/")).rejects.toBeInstanceOf(ConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets_network_errors_through_unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(djangoRequest("me/")).rejects.toThrow("fetch failed");
  });
});

describe("upstreamFailure", () => {
  it("reports_a_config_error_as_500_and_logs_the_reason", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = upstreamFailure("auth/login", new ConfigError("API_BASE_URL must be set"));
    expect(res.status).toBe(500);
    expect((await res.json()).message).toMatch(/not configured/i);
    expect(logged).toHaveBeenCalledWith("[auth/login] API_BASE_URL must be set");
  });

  it("reports_anything_else_as_502_without_logging_internals", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = upstreamFailure("auth/login", new TypeError("fetch failed"));
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/could not reach the server/i);
    expect(logged).not.toHaveBeenCalled();
  });
});
