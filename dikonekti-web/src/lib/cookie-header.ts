// RFC 6265 cookie-octet: printable ASCII except whitespace, DQUOTE, comma, semicolon, backslash.
const COOKIE_VALUE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;

/** Returns `header` with `name=value` set, replacing any existing cookie of that name. */
export function withCookie(header: string | null | undefined, name: string, value: string): string {
  if (!COOKIE_VALUE.test(value)) throw new Error("Invalid cookie value");
  const kept = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && part.split("=")[0] !== name);
  return [...kept, `${name}=${value}`].join("; ");
}
