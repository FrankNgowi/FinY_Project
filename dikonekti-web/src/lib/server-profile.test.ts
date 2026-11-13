import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));

import { getServerProfile } from "./server-profile";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  jar.clear();
  vi.stubEnv("API_BASE_URL", "http://django.test/api");
});
afterEach(() => vi.unstubAllEnvs());

describe("getServerProfile", () => {
  it("returns_the_profile_for_a_valid_token", async () => {
    jar.set("dik_access", "ACC");
    const fetchMock = vi.fn().mockResolvedValue(json({ username: "dr1", role: "doctor" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getServerProfile()).resolves.toEqual({ status: "ok", profile: { username: "dr1", role: "doctor" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://django.test/api/me/");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer ACC");
  });

  it("is_unauthorized_without_calling_django_when_there_is_no_access_cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getServerProfile()).resolves.toEqual({ status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is_unauthorized_on_401", async () => {
    jar.set("dik_access", "OLD");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "expired" }, 401)));
    await expect(getServerProfile()).resolves.toEqual({ status: "unauthorized" });
  });

  it("is_an_error_when_django_is_down_or_misbehaves", async () => {
    jar.set("dik_access", "ACC");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(getServerProfile()).resolves.toEqual({ status: "error" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })));
    await expect(getServerProfile()).resolves.toEqual({ status: "error" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json("not an object")));
    await expect(getServerProfile()).resolves.toEqual({ status: "error" });
  });
});
