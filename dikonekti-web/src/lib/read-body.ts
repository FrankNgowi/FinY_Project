export const MAX_PROXY_BODY_BYTES = 6 * 1024 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("The request body is too large.");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Reads a request body as raw bytes, never as text (text would corrupt a binary upload), and
 * refuses anything over `maxBytes`. A body that declares itself too large is refused without
 * reading it. The count is also enforced while reading, because a declared length can be missing
 * or wrong, so the memory used never exceeds the cap by more than one chunk.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
