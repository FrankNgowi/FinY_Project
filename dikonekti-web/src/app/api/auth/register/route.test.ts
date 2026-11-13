import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown) =>
  new Request("http://web.test/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const upstream = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const valid = {
  username: "dr_new",
  password: "Str0ng#Pass2026",
  first_name: "Neema",
  middle_name: "",
  last_name: "Kariuki",
  email: "neema@example.test",
  phone_number: "+254700123123",
  area: "Stone Town",
  specialization: "Vision",
};
const created = { access: "ACC", refresh: "REF", profile: { username: "dr_new", role: "doctor", display_name: "Dr. Neema Kariuki" } };

beforeEach(() => vi.stubEnv("API_BASE_URL", "http://django.test/api"));
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/register", () => {
  it("creates_a_doctor_signs_in_with_httpOnly_cookies_and_returns_no_tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream(created)));
    const res = await POST(post(valid));
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ role: "doctor", display_name: "Dr. Neema Kariuki" });
    expect(text).not.toContain("ACC");
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.every((c) => /HttpOnly/i.test(c))).toBe(true);
  });

  it("always_registers_a_doctor_whatever_the_client_sends", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(created));
    vi.stubGlobal("fetch", fetchMock);
    await POST(post({ ...valid, role: "disabled", registered_doctor_username: "qa_dr1", disability_type: "Vision", is_staff: true, is_superuser: true, id: 1 }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://django.test/api/auth/register/");
    const sent = JSON.parse(init.body);
    expect(sent.role).toBe("doctor");
    expect(Object.keys(sent).sort()).toEqual(
      ["area", "email", "first_name", "last_name", "middle_name", "password", "phone_number", "role", "specialization", "username"],
    );
  });

  it("trims_text_fields_but_not_the_password", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(created));
    vi.stubGlobal("fetch", fetchMock);
    await POST(post({ ...valid, username: "  dr_new ", area: " Stone Town ", password: " pw pw " }));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.username).toBe("dr_new");
    expect(sent.area).toBe("Stone Town");
    expect(sent.password).toBe(" pw pw ");
  });

  it.each([
    ["username"],
    ["password"],
    ["first_name"],
    ["last_name"],
    ["phone_number"],
    ["area"],
    ["specialization"],
  ])("rejects_a_missing_or_blank_%s_without_calling_django", async (field) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const value of [undefined, "", "   "]) {
      const res = await POST(post({ ...valid, [field]: value }));
      expect(res.status).toBe(400);
      expect((await res.json()).errors[field]).toEqual([expect.any(String)]);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["not json"], ["null"], ["[]"], ['"str"']])("rejects_invalid_body_%s", async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects_non_string_values", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await POST(post({ ...valid, area: { x: 1 }, username: 5 }));
    expect(res.status).toBe(400);
  });

  it("forwards_django_field_errors_and_sets_no_cookies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ username: ["A user with that username already exists."], password: ["This password is too common."] }, 400)));
    const res = await POST(post(valid));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toEqual({ username: ["A user with that username already exists."], password: ["This password is too common."] });
    expect(body.message).toEqual(expect.any(String));
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("returns_502_without_leaking_an_upstream_html_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Traceback secret</html>", { status: 500 })));
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("Traceback");
  });

  it("returns_502_when_django_is_down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("does_not_sign_in_when_django_returns_a_non_doctor_profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ ...created, profile: { ...created.profile, role: "disabled" } })));
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("returns_502_when_a_201_is_missing_tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream({ profile: created.profile })));
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it("reports_a_missing_API_BASE_URL_as_a_configuration_error_and_logs_it", async () => {
    vi.stubEnv("API_BASE_URL", "");
    vi.stubGlobal("fetch", vi.fn());
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(post(valid));
    expect(res.status).toBe(500);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("API_BASE_URL"));
  });

  it.each([["Nairobi"], ["stone town"], ["Stone Town; drop"], ["<script>"]])("rejects_an_area_that_is_not_in_the_list_%s", async (area) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(post({ ...valid, area }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.area).toEqual([expect.stringMatching(/select/i)]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts_others_as_an_area_like_the_mobile_app", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(created));
    vi.stubGlobal("fetch", fetchMock);
    await POST(post({ ...valid, area: "Others" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).area).toBe("Others");
  });

  it("accepts_a_free_text_specialization_from_the_others_option", async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(created));
    vi.stubGlobal("fetch", fetchMock);
    await POST(post({ ...valid, specialization: "  Autism care " }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).specialization).toBe("Autism care");
  });
});
