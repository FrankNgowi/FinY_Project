import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithDjango, parseSessionPayload, registerDoctor } from "./django-session";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const session = (role = "doctor") => ({ access: "ACC", refresh: "REF", profile: { role, display_name: "Dr. Jane Doe" } });
const payload = {
  username: "dr_new",
  password: "Str0ng#Pass2026",
  first_name: "Neema",
  middle_name: "",
  last_name: "Kariuki",
  email: "",
  phone_number: "+254700123123",
  area: "Stone Town",
  specialization: "Vision",
};

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("parseSessionPayload", () => {
  it("returns_the_tokens_role_and_display_name", () => {
    expect(parseSessionPayload(session())).toEqual({ access: "ACC", refresh: "REF", role: "doctor", displayName: "Dr. Jane Doe" });
  });

  it.each([
    [null],
    [undefined],
    ["text"],
    [[]],
    [{}],
    [{ access: "A" }],
    [{ ...session(), access: "" }],
    [{ ...session(), refresh: 5 }],
    [{ access: "A", refresh: "R", profile: null }],
    [{ access: "A", refresh: "R", profile: { role: 1, display_name: "x" } }],
    [{ access: "A", refresh: "R", profile: { role: "doctor" } }],
  ])("returns_null_for_%j", (data) => {
    expect(parseSessionPayload(data)).toBeNull();
  });
});

describe("loginWithDjango", () => {
  it("posts_the_credentials_and_returns_the_session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(session("disabled")));
    vi.stubGlobal("fetch", fetchMock);
    const result = await loginWithDjango({ username: "u", password: "p" });
    expect(result).toEqual({ kind: "session", session: { access: "ACC", refresh: "REF", role: "disabled", displayName: "Dr. Jane Doe" } });
    expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/auth/login/");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ username: "u", password: "p" });
  });

  it.each([400, 401])("reports_a_%i_as_rejected_with_the_django_message", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "No active account found" }, status)));
    await expect(loginWithDjango({ username: "u", password: "p" })).resolves.toEqual({ kind: "rejected", status, message: "No active account found" });
  });

  it("is_unavailable_for_a_5xx_or_a_malformed_200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })));
    await expect(loginWithDjango({ username: "u", password: "p" })).resolves.toEqual({ kind: "unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ access: "A" })));
    await expect(loginWithDjango({ username: "u", password: "p" })).resolves.toEqual({ kind: "unavailable" });
  });

  it("lets_network_and_config_errors_propagate_for_the_caller_to_map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(loginWithDjango({ username: "u", password: "p" })).rejects.toThrow("fetch failed");
  });
});

describe("registerDoctor", () => {
  it("always_registers_the_doctor_role", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(session(), 201));
    vi.stubGlobal("fetch", fetchMock);
    const result = await registerDoctor({ ...payload, role: "disabled" } as typeof payload);
    expect(result.kind).toBe("session");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).role).toBe("doctor");
    expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/auth/register/");
  });

  it("returns_field_errors_for_a_400", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ username: ["Taken."] }, 400)));
    await expect(registerDoctor(payload)).resolves.toEqual({
      kind: "invalid",
      message: "Please fix the highlighted fields.",
      errors: { username: ["Taken."] },
    });
  });

  it("uses_a_form_level_message_for_a_non_field_400", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "Registration is closed." }, 400)));
    await expect(registerDoctor(payload)).resolves.toEqual({ kind: "invalid", message: "Registration is closed.", errors: { form: ["Registration is closed."] } });
  });

  it("does_not_accept_a_session_whose_role_is_not_doctor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(session("disabled"), 201)));
    await expect(registerDoctor(payload)).resolves.toEqual({ kind: "unavailable" });
  });

  it("is_unavailable_for_a_non_201_success_or_a_server_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(session(), 200)));
    await expect(registerDoctor(payload)).resolves.toEqual({ kind: "unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await expect(registerDoctor(payload)).resolves.toEqual({ kind: "unavailable" });
  });
});
