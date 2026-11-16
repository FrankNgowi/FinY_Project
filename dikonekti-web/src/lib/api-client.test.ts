// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, extractErrorMessage, proxyUrl } from "./api-client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let replace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replace = vi.fn();
  vi.stubGlobal("location", { ...window.location, replace });
});
afterEach(() => vi.unstubAllGlobals());

describe("extractErrorMessage", () => {
  it.each([
    [{ detail: "Not found." }, "Not found."],
    [{ message: "Bad gateway" }, "Bad gateway"],
    [{ body: ["Message cannot be empty."] }, "Message cannot be empty."],
    [{ non_field_errors: ["No active account found."] }, "No active account found."],
    [{ recipient_username: ["That patient is not registered with you."] }, "That patient is not registered with you."],
    [["first", "second"], "first"],
    ["plain text error", "plain text error"],
  ])("pulls_a_message_out_of_%j", (body, expected) => {
    expect(extractErrorMessage(body)).toBe(expected);
  });

  it.each([[null], [undefined], [{}], [[]], [""], [{ x: 1 }], [42]])(
    "falls_back_for_%j",
    (body) => {
      expect(extractErrorMessage(body)).toBe("Something went wrong. Please try again.");
    },
  );
});

describe("apiFetch", () => {
  it("returns_parsed_json_and_calls_the_same_origin_proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([{ id: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("alerts/")).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/alerts", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("sends_json_bodies_with_a_content_type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 2 }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("messages/", { method: "POST", body: { body: "hi", recipient_username: "p1" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ body: "hi", recipient_username: "p1" }));
  });

  it("throws_ApiError_with_the_drf_message_on_400", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ body: ["Message cannot be empty."] }, 400)));
    await expect(apiFetch("messages/", { method: "POST", body: {} })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Message cannot be empty.",
    });
  });

  it("uses_a_friendly_message_for_an_empty_error_body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({
      status: 500,
      message: "Something went wrong. Please try again.",
    });
  });

  it("does_not_leak_a_non_json_upstream_body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad Gateway stack trace</html>", { status: 502 })));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({
      status: 502,
      message: "Something went wrong. Please try again.",
    });
  });

  it("redirects_to_login_on_401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: "expired" }, 401)));
    await expect(apiFetch("alerts/")).rejects.toBeInstanceOf(ApiError);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("can_skip_the_login_redirect_so_a_login_form_can_show_a_401_message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "No active account found" }, 401)));
    await expect(apiFetch("auth/login", { method: "POST", body: {}, redirectOnUnauthorized: false })).rejects.toMatchObject({
      status: 401,
      message: "No active account found",
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("exposes_the_parsed_error_body_so_forms_can_read_field_errors", async () => {
    const body = { message: "Please fix the highlighted fields.", errors: { username: ["Taken."] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(body, 400)));
    await expect(apiFetch("auth/register", { method: "POST", body: {} })).rejects.toMatchObject({ status: 400, body });
  });

  it("wraps_network_failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server. Check your connection and try again.",
    });
  });

  it("handles_204_without_parsing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch("x/", { method: "POST" })).resolves.toBeUndefined();
  });
});

describe("apiFetch with files and verification", () => {
  it("sends_form_data_as_is_and_never_forces_a_json_content_type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("document", new File([new Uint8Array([0, 255, 1])], "c.pdf", { type: "application/pdf" }));
    await apiFetch("me/verification/", { method: "POST", body: form });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/verification");
    expect(init.body).toBe(form); // the browser adds the multipart boundary itself
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).not.toContain("content-type");
    expect(init.headers.Accept).toBe("application/json");
  });

  it("still_sends_plain_objects_as_json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("messages/", { method: "POST", body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe('{"a":1}');
  });

  it("sends_a_doctor_who_lost_approval_to_the_verification_screen", async () => {
    const body = { detail: "Your account is awaiting verification.", code: "verification_required" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(body, 403)));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({ name: "ApiError", status: 403 });
    expect(replace).toHaveBeenCalledWith("/verification");
  });

  it.each([
    [{ detail: "You do not have permission.", code: "permission_denied" }],
    [{ detail: "Only doctors can perform this action." }],
    [{ code: ["verification_required"] }],
    [{ detail: "verification_required" }],
  ])("does_not_redirect_for_other_403_bodies_%j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(body, 403)));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({ status: 403 });
    expect(replace).not.toHaveBeenCalled();
  });

  it("does_not_redirect_for_a_403_with_no_json_body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Forbidden</html>", { status: 403 })));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({ status: 403 });
    expect(replace).not.toHaveBeenCalled();
  });

  it("does_not_redirect_when_a_different_status_carries_the_code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code: "verification_required" }, 400)));
    await expect(apiFetch("alerts/")).rejects.toMatchObject({ status: 400 });
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("proxyUrl", () => {
  it.each([
    ["alerts/", "/api/alerts"],
    ["alerts", "/api/alerts"],
    ["/alerts/", "/api/alerts"],
    ["alerts/7/acknowledge/", "/api/alerts/7/acknowledge"],
    ["messages/?patient=p%201", "/api/messages?patient=p%201"],
    ["messages?patient=a/b/", "/api/messages?patient=a/b/"],
    ["messages?patient=a?b&x=1", "/api/messages?patient=a?b&x=1"],
  ])("never_produces_a_url_next_would_redirect_or_drops_query_text_%s", (input, expected) => {
    expect(proxyUrl(input)).toBe(expected);
  });
});
