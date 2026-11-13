import { describe, expect, it } from "vitest";
import { withCookie } from "./cookie-header";

describe("withCookie", () => {
  it("adds_a_cookie_to_an_empty_header", () => {
    expect(withCookie("", "a", "1")).toBe("a=1");
    expect(withCookie(null, "a", "1")).toBe("a=1");
  });

  it("replaces_an_existing_cookie_and_keeps_others", () => {
    expect(withCookie("x=1; dik_access=old; y=2", "dik_access", "new")).toBe("x=1; y=2; dik_access=new");
  });

  it("does_not_match_cookies_that_only_share_a_prefix", () => {
    expect(withCookie("dik_access_other=1", "dik_access", "n")).toBe("dik_access_other=1; dik_access=n");
  });

  it("rejects_values_that_could_inject_extra_cookies", () => {
    expect(() => withCookie("", "a", "1; admin=true")).toThrow();
    expect(() => withCookie("", "a", "line\nbreak")).toThrow();
  });
});
