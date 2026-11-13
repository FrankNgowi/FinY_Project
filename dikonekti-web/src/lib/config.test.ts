import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("getApiBaseUrl", () => {
  it("returns_the_configured_url", () => {
    vi.stubEnv("API_BASE_URL", "http://localhost:8000/api");
    expect(getApiBaseUrl()).toBe("http://localhost:8000/api");
  });

  it("trims_trailing_slashes_and_whitespace", () => {
    vi.stubEnv("API_BASE_URL", "  https://api.example.test/api//  ");
    expect(getApiBaseUrl()).toBe("https://api.example.test/api");
  });

  it("throws_when_unset", () => {
    vi.stubEnv("API_BASE_URL", "");
    expect(() => getApiBaseUrl()).toThrow(/API_BASE_URL/);
  });

  it("throws_on_whitespace_only", () => {
    vi.stubEnv("API_BASE_URL", "   ");
    expect(() => getApiBaseUrl()).toThrow(/API_BASE_URL/);
  });

  it("throws_on_non_http_scheme", () => {
    for (const bad of ["ftp://x.test/api", "javascript:alert(1)", "localhost:8000/api", "/api"]) {
      vi.stubEnv("API_BASE_URL", bad);
      expect(() => getApiBaseUrl()).toThrow(/API_BASE_URL/);
    }
  });
});
