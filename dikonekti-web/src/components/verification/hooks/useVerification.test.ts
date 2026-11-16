// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { jsonResponse } from "@/test/fixtures";
import {
  TOO_MANY_UPLOADS_MESSAGE,
  VERIFICATION_POLL_MS,
  uploadDocument,
  uploadErrorMessage,
} from "./useVerification";

afterEach(() => vi.unstubAllGlobals());

describe("polling", () => {
  it("is_every_30_seconds", () => {
    expect(VERIFICATION_POLL_MS).toBe(30_000);
  });
});

describe("uploadDocument", () => {
  it("posts_the_file_unchanged_in_a_form_field_named_document", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "pending", submitted_at: "2026-11-13T10:42:00Z", rejection_reason: "" }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([0, 255, 1, 2])], "cert.pdf", { type: "application/pdf" });
    const result = await uploadDocument(file);
    expect(result.status).toBe("pending");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/verification");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("document")).toBe(file);
    expect(Object.keys(init.headers).map((k: string) => k.toLowerCase())).not.toContain("content-type");
  });
});

describe("uploadErrorMessage", () => {
  it("explains_a_too_large_body_in_plain_words", () => {
    expect(uploadErrorMessage(new ApiError(413, "File too large (max 5 MB)."))).toBe("The file is larger than 5 MB.");
    expect(uploadErrorMessage(new ApiError(413, "The request is too large."))).toBe("The file is larger than 5 MB.");
  });

  it("explains_the_hourly_limit_without_djangos_raw_text", () => {
    const raw = "Request was throttled. Expected available in 3412 seconds.";
    const message = uploadErrorMessage(new ApiError(429, raw));
    expect(message).toBe("Too many uploads. Please wait a while and try again.");
    expect(message).toBe(TOO_MANY_UPLOADS_MESSAGE);
    expect(message).not.toMatch(/throttled|seconds/i);
  });

  it("shows_the_servers_own_message_for_a_refused_file", () => {
    expect(uploadErrorMessage(new ApiError(400, "Only PDF, JPEG or PNG files are accepted."))).toBe(
      "Only PDF, JPEG or PNG files are accepted.",
    );
    expect(uploadErrorMessage(new ApiError(409, "Your document was already submitted."))).toBe(
      "Your document was already submitted.",
    );
  });

  it("shows_the_clients_network_message", () => {
    expect(uploadErrorMessage(new ApiError(0, "Could not reach the server. Check your connection and try again."))).toMatch(
      /could not reach the server/i,
    );
  });

  it("falls_back_for_anything_else", () => {
    expect(uploadErrorMessage(new Error("boom"))).toBe("boom");
    expect(uploadErrorMessage("weird")).toBe("Something went wrong. Please try again.");
    expect(uploadErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});
