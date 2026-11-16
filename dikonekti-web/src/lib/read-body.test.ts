import { describe, expect, it, vi } from "vitest";
import { BodyTooLargeError, MAX_PROXY_BODY_BYTES, readBodyCapped } from "./read-body";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://web.test/api/x", { method: "POST", body, headers });

function streamOf(chunks: Uint8Array[], onPull?: () => void) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
}
const streamed = (stream: ReadableStream, headers: Record<string, string> = {}) =>
  new Request("http://web.test/api/x", { method: "POST", body: stream, headers, duplex: "half" } as RequestInit);

describe("readBodyCapped", () => {
  it("caps_at_6_mb", () => {
    expect(MAX_PROXY_BODY_BYTES).toBe(6 * 1024 * 1024);
  });

  it("returns_the_exact_bytes_including_zeros_and_invalid_utf8", async () => {
    const bytes = Uint8Array.from([0, 255, 254, 0, 128, 192, 193, 0x0d, 0x0a, 0]);
    const out = await readBodyCapped(post(bytes), 100);
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });

  it("returns_empty_bytes_when_there_is_no_body", async () => {
    const out = await readBodyCapped(new Request("http://web.test/x", { method: "POST" }), 10);
    expect(out.byteLength).toBe(0);
  });

  it("accepts_a_body_of_exactly_the_cap_and_refuses_one_byte_more", async () => {
    expect((await readBodyCapped(post(new Uint8Array(100)), 100)).byteLength).toBe(100);
    await expect(readBodyCapped(post(new Uint8Array(101)), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("refuses_from_a_declared_length_without_reading_the_stream", async () => {
    const request = streamed(streamOf([new Uint8Array(5)]), { "content-length": "101" });
    await expect(readBodyCapped(request, 100)).rejects.toBeInstanceOf(BodyTooLargeError);
    // No reader was ever taken, so not one byte of the body was consumed.
    expect(request.bodyUsed).toBe(false);
  });

  it("allows_a_declared_length_of_exactly_the_cap", async () => {
    const out = await readBodyCapped(post(new Uint8Array(100), { "content-length": "100" }), 100);
    expect(out.byteLength).toBe(100);
  });

  it("stops_reading_soon_after_the_cap_when_no_length_is_declared", async () => {
    const pulled = vi.fn();
    const chunks = Array.from({ length: 1000 }, () => new Uint8Array(10));
    await expect(readBodyCapped(streamed(streamOf(chunks, pulled)), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled.mock.calls.length).toBeLessThan(20); // not the whole 10 000 bytes
  });

  it("does_not_trust_a_declared_length_that_is_smaller_than_the_real_body", async () => {
    const lying = post(new Uint8Array(500), { "content-length": "5" });
    await expect(readBodyCapped(lying, 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it.each([["abc"], ["-1"], ["1e9"], [""], ["NaN"]])("falls_back_to_counting_for_a_garbage_length_%j", async (value) => {
    expect((await readBodyCapped(post(new Uint8Array(50), { "content-length": value }), 100)).byteLength).toBe(50);
    await expect(readBodyCapped(post(new Uint8Array(150), { "content-length": value }), 100)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it("joins_many_chunks_in_order", async () => {
    const chunks = [Uint8Array.from([1, 2]), Uint8Array.from([3]), Uint8Array.from([4, 5, 6])];
    const out = await readBodyCapped(streamed(streamOf(chunks)), 100);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
