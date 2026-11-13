import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("expires_both_cookies_and_returns_204", async () => {
    const res = await POST();
    expect(res.status).toBe(204);
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.every((c) => /Max-Age=0/i.test(c) && /HttpOnly/i.test(c))).toBe(true);
  });

  it("works_without_an_existing_session", async () => {
    const res = await POST();
    expect(res.status).toBe(204);
  });
});
