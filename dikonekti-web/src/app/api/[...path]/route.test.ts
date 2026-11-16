import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "./route";

type Handler = typeof GET;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function call(
  handler: Handler,
  path: string[],
  init: { method?: string; cookie?: string; headers?: Record<string, string>; body?: string | Uint8Array<ArrayBuffer>; query?: string } = {},
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
    expect(new TextDecoder().decode(init.body)).toBe(body);
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

  describe("uploads", () => {
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    const BOUNDARY = "----dik-test-boundary";
    const multipart = (file: Uint8Array) => {
      const enc = new TextEncoder();
      const head = enc.encode(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="document"; filename="c.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      );
      const tail = enc.encode(`\r\n--${BOUNDARY}--\r\n`);
      const out = new Uint8Array(head.length + file.length + tail.length);
      out.set(head, 0);
      out.set(file, head.length);
      out.set(tail, head.length + file.length);
      return out;
    };
    // Every byte value, including 0x00 and 0xFF and sequences that are not valid UTF-8.
    const binary = (size: number) => Uint8Array.from({ length: size }, (_, i) => (i * 31 + 7) & 255);
    const headers = { "content-type": `multipart/form-data; boundary=${BOUNDARY}` };

    it("forwards_a_1_mb_binary_upload_byte_for_byte_with_its_boundary_content_type", async () => {
      const fetchMock = vi.fn().mockResolvedValue(json({ status: "pending" }));
      vi.stubGlobal("fetch", fetchMock);
      const body = multipart(binary(1024 * 1024));
      const res = await call(POST, ["me", "verification"], { method: "POST", cookie: cookie("ACC"), body, headers });
      expect(res.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://django.test/api/me/verification/");
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(Uint8Array);
      expect(init.body.byteLength).toBe(body.byteLength);
      expect(sha(init.body)).toBe(sha(body));
      expect(new Headers(init.headers).get("content-type")).toBe(headers["content-type"]);
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer ACC");
    });

    it("refuses_a_body_over_6_mb_with_413_and_never_calls_django", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const body = multipart(binary(6 * 1024 * 1024 + 1));
      const res = await call(POST, ["me", "verification"], { method: "POST", cookie: cookie("ACC"), body, headers });
      expect(res.status).toBe(413);
      expect((await res.json()).message).toBe("The request is too large.");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses_from_the_declared_length_even_when_the_real_body_is_small", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await call(POST, ["me", "verification"], {
        method: "POST",
        cookie: cookie("ACC"),
        body: multipart(binary(10)),
        headers: { ...headers, "content-length": String(6 * 1024 * 1024 + 1) },
      });
      expect(res.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("accepts_a_body_of_exactly_6_mb", async () => {
      const fetchMock = vi.fn().mockResolvedValue(json({ status: "pending" }));
      vi.stubGlobal("fetch", fetchMock);
      const exact = new Uint8Array(6 * 1024 * 1024);
      const res = await call(POST, ["me", "verification"], { method: "POST", cookie: cookie("ACC"), body: exact, headers });
      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("resends_the_identical_bytes_when_it_retries_after_refreshing_the_token", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ detail: "expired" }, 401))
        .mockResolvedValueOnce(json({ access: "NEW", refresh: "NEWREF" }))
        .mockResolvedValueOnce(json({ status: "pending" }));
      vi.stubGlobal("fetch", fetchMock);
      const body = multipart(binary(50_000));
      const res = await call(POST, ["me", "verification"], { method: "POST", cookie: cookie("OLD", "REF"), body, headers });
      expect(res.status).toBe(200);
      const first = fetchMock.mock.calls[0][1].body;
      const second = fetchMock.mock.calls[2][1].body;
      expect(sha(first)).toBe(sha(body));
      expect(sha(second)).toBe(sha(body));
      expect(new Headers(fetchMock.mock.calls[2][1].headers).get("content-type")).toBe(headers["content-type"]);
    });

    it("relays_django_refusals_with_their_status_so_the_browser_can_explain_them", async () => {
      for (const status of [400, 409, 413, 429]) {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: `refused ${status}` }, status)));
        const res = await call(POST, ["me", "verification"], {
          method: "POST",
          cookie: cookie("ACC"),
          body: multipart(binary(10)),
          headers,
        });
        expect(res.status).toBe(status);
        expect(await res.json()).toEqual({ detail: `refused ${status}` });
      }
    });

    it("relays_the_verification_required_code_untouched", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(json({ detail: "Your account is awaiting verification.", code: "verification_required" }, 403)),
      );
      const res = await call(GET, ["patients"], { cookie: cookie("ACC") });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("verification_required");
    });

    it("reads_the_status_with_a_get", async () => {
      const fetchMock = vi.fn().mockResolvedValue(json({ status: "pending", submitted_at: "2026-11-13T10:42:00Z", rejection_reason: "" }));
      vi.stubGlobal("fetch", fetchMock);
      const res = await call(GET, ["me", "verification"], { cookie: cookie("ACC") });
      expect(res.status).toBe(200);
      expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/me/verification/");
    });
  });

  describe("admin review", () => {
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    // Every byte value, including 0x00 and 0xFF, so a text conversion anywhere would corrupt it.
    const file = (head: number[], size = 200_000) =>
      Uint8Array.from({ length: size }, (_, i) => (i < head.length ? head[i] : (i * 31 + 7) & 255));
    const PDF = file([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const JPG = file([0xff, 0xd8, 0xff, 0xe0]);
    const PNG = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const upstreamFile = (bytes: Uint8Array<ArrayBuffer>, type: string, extra: Record<string, string> = {}) =>
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": type,
          "content-disposition": 'inline; filename="certificate"',
          "x-content-type-options": "nosniff",
          "content-security-policy": "sandbox",
          "content-length": String(bytes.byteLength),
          ...extra,
        },
      });
    const DOC = ["admin", "verifications", "7", "document"];
    const bytesOf = async (res: Response) => new Uint8Array(await res.arrayBuffer());

    it("forwards_only_the_status_query_to_the_admin_list", async () => {
      const fetchMock = vi.fn().mockImplementation(async () => json([]));
      vi.stubGlobal("fetch", fetchMock);
      await call(GET, ["admin", "verifications"], { cookie: cookie("ACC"), query: "?status=all&evil=1&patient=p1" });
      expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/admin/verifications/?status=all");
      await call(GET, ["admin", "verifications"], { cookie: cookie("ACC"), query: "?evil=1" });
      expect(fetchMock.mock.calls[1][0]).toBe("http://django.test/api/admin/verifications/");
      await call(GET, ["alerts"], { cookie: cookie("ACC"), query: "?status=all" });
      expect(fetchMock.mock.calls[2][0]).toBe("http://django.test/api/alerts/");
      await call(GET, ["messages"], { cookie: cookie("ACC"), query: "?status=all&patient=p%201" });
      expect(fetchMock.mock.calls[3][0]).toBe("http://django.test/api/messages/?patient=p%201");
    });

    it.each([
      ["a PDF", PDF, "application/pdf"],
      ["a JPEG", JPG, "image/jpeg"],
      ["a PNG", PNG, "image/png"],
    ])("passes_%s_through_byte_for_byte_with_the_safe_headers", async (_label, bytes, type) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamFile(bytes, type)));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe(type);
      expect(res.headers.get("content-disposition")).toBe('inline; filename="certificate"');
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe("sandbox");
      expect(res.headers.get("content-length")).toBe(String(bytes.byteLength));
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(sha(await bytesOf(res))).toBe(sha(bytes));
    });

    it("sets_nosniff_sandbox_and_a_fixed_file_name_itself_even_when_django_sends_none_of_them", async () => {
      const bare = new Response(PDF, { status: 200, headers: { "content-type": "application/pdf" } });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bare));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe("sandbox");
      expect(res.headers.get("content-disposition")).toBe('inline; filename="certificate"');
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    });

    it("never_lets_the_upstream_choose_the_file_name_or_weaken_the_isolation_headers", async () => {
      const hostile = upstreamFile(PDF, "application/pdf", {
        "content-disposition": 'attachment; filename="../../evil.html"',
        "content-security-policy": "default-src *",
        "x-content-type-options": "",
      });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(hostile));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.headers.get("content-disposition")).toBe('inline; filename="certificate"');
      expect(res.headers.get("content-security-policy")).toBe("sandbox");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it.each([["gzip"], ["br"], ["deflate"], ["GZIP"]])(
      "does_not_forward_a_content_length_that_describes_a_%s_compressed_reply",
      async (encoding) => {
        // fetch decodes the body but leaves the compressed length in the headers; forwarding it
        // would make the browser report a length mismatch or show a truncated file.
        const compressed = upstreamFile(PDF, "application/pdf", { "content-encoding": encoding, "content-length": "123" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(compressed));
        const res = await call(GET, DOC, { cookie: cookie("ACC") });
        expect(res.status).toBe(200);
        expect(res.headers.get("content-length")).toBeNull();
        expect(res.headers.get("content-encoding")).toBeNull();
        expect(sha(await bytesOf(res))).toBe(sha(PDF));
      },
    );

    it("still_forwards_the_length_when_the_reply_says_identity_or_has_no_encoding", async () => {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => upstreamFile(PDF, "application/pdf", { "content-encoding": "identity" })));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.headers.get("content-length")).toBe(String(PDF.byteLength));
    });

    it("does_not_forward_a_malformed_content_length", async () => {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => upstreamFile(PDF, "application/pdf", { "content-length": "12abc" })));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-length")).not.toBe("12abc");
    });

    it("sends_the_admins_token_and_asks_django_for_the_right_file", async () => {
      const fetchMock = vi.fn().mockResolvedValue(upstreamFile(PDF, "application/pdf"));
      vi.stubGlobal("fetch", fetchMock);
      await call(GET, DOC, { cookie: cookie("ACC") });
      expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/admin/verifications/7/document/");
      expect(new Headers(fetchMock.mock.calls[0][1].headers).get("authorization")).toBe("Bearer ACC");
    });

    it("accepts_a_content_type_with_parameters_and_in_any_case", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamFile(PDF, "Application/PDF; charset=binary")));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.status).toBe(200);
      expect(sha(await bytesOf(res))).toBe(sha(PDF));
    });

    it.each([["text/html"], ["image/svg+xml"], ["application/javascript"], ["application/octet-stream"], ["text/plain"], [""]])(
      "refuses_to_relay_a_%j_reply_from_the_document_route",
      async (type) => {
        const body = new TextEncoder().encode("<script>alert(document.cookie)</script>");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamFile(body, type)));
        const res = await call(GET, DOC, { cookie: cookie("ACC") });
        expect(res.status).toBe(502);
        const text = await res.text();
        expect(text).not.toContain("script");
        expect(res.headers.get("content-type")).toMatch(/application\/json/);
      },
    );

    it("still_returns_djangos_json_errors_from_the_document_route", async () => {
      for (const status of [403, 404]) {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: `no ${status}` }, status)));
        const res = await call(GET, DOC, { cookie: cookie("ACC") });
        expect(res.status).toBe(status);
        expect(await res.json()).toEqual({ detail: `no ${status}` });
      }
    });

    it("hides_a_django_error_page_on_the_document_route", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Traceback</html>", { status: 500, headers: { "content-type": "text/html" } })));
      const res = await call(GET, DOC, { cookie: cookie("ACC") });
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain("Traceback");
    });

    it("does_not_pass_a_file_through_any_other_route", async () => {
      for (const path of [["alerts"], ["me", "verification"], ["admin", "verifications"]]) {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamFile(PDF, "application/pdf")));
        const res = await call(GET, path, { cookie: cookie("ACC") });
        expect(res.status).toBe(502);
        expect(res.headers.get("content-type")).toMatch(/application\/json/);
      }
    });

    it("refreshes_the_token_after_a_401_then_streams_the_second_reply", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(json({ detail: "expired" }, 401))
        .mockResolvedValueOnce(json({ access: "NEW", refresh: "NEWREF" }))
        .mockResolvedValueOnce(upstreamFile(PNG, "image/png"));
      vi.stubGlobal("fetch", fetchMock);
      const res = await call(GET, DOC, { cookie: cookie("OLD", "REF") });
      expect(res.status).toBe(200);
      expect(sha(await bytesOf(res))).toBe(sha(PNG));
      expect(new Headers(fetchMock.mock.calls[2][1].headers).get("authorization")).toBe("Bearer NEW");
      expect(res.headers.getSetCookie().join("\n")).toMatch(/dik_access=NEW/);
    });

    it("returns_401_and_never_calls_django_without_a_session", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await call(GET, DOC);
      expect(res.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns_404_without_calling_django_for_a_bad_document_id", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await call(GET, ["admin", "verifications", "abc", "document"], { cookie: cookie("ACC") });
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends_approve_with_no_body_and_reject_with_its_reason", async () => {
      const fetchMock = vi.fn().mockImplementation(async () => json({ id: 7, status: "approved" }));
      vi.stubGlobal("fetch", fetchMock);
      const approve = await call(POST, ["admin", "verifications", "7", "approve"], { method: "POST", cookie: cookie("ACC"), body: "" });
      expect(approve.status).toBe(200);
      expect(fetchMock.mock.calls[0][0]).toBe("http://django.test/api/admin/verifications/7/approve/");
      const reason = JSON.stringify({ reason: "Name does not match." });
      await call(POST, ["admin", "verifications", "7", "reject"], {
        method: "POST",
        cookie: cookie("ACC"),
        body: reason,
        headers: { "content-type": "application/json" },
      });
      expect(fetchMock.mock.calls[1][0]).toBe("http://django.test/api/admin/verifications/7/reject/");
      expect(new TextDecoder().decode(fetchMock.mock.calls[1][1].body)).toBe(reason);
    });

    it("relays_a_conflict_and_a_forbidden_decision_with_their_status", async () => {
      for (const status of [403, 409]) {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ detail: `d${status}` }, status)));
        const res = await call(POST, ["admin", "verifications", "7", "approve"], { method: "POST", cookie: cookie("ACC"), body: "" });
        expect(res.status).toBe(status);
        expect(await res.json()).toEqual({ detail: `d${status}` });
      }
    });
  });
});
