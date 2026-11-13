import { describe, expect, it } from "vitest";
import { decideRoute, unauthorizedRedirect } from "./route-gate";

describe("decideRoute", () => {
  it("sends_a_doctor_to_the_dashboard", () => {
    expect(decideRoute({ role: "doctor" })).toBe("dashboard");
  });

  it("is_case_insensitive_like_the_mobile_app", () => {
    expect(decideRoute({ role: "Doctor" })).toBe("dashboard");
    expect(decideRoute({ role: "DOCTOR" })).toBe("dashboard");
  });

  it("sends_a_disabled_user_to_unsupported", () => {
    expect(decideRoute({ role: "disabled" })).toBe("unsupported");
  });

  it.each([[""], ["admin"], ["doctor "], ["doctors"], ["undefined"]])("sends_role_%j_to_unsupported", (role) => {
    expect(decideRoute({ role })).toBe("unsupported");
  });

  it("sends_a_profile_without_a_role_to_unsupported", () => {
    expect(decideRoute({} as { role: string })).toBe("unsupported");
    expect(decideRoute({ role: null } as unknown as { role: string })).toBe("unsupported");
  });

  it("sends_no_profile_to_login", () => {
    expect(decideRoute(null)).toBe("login");
  });
});

describe("unauthorizedRedirect", () => {
  it("tries_a_refresh_first", () => {
    expect(unauthorizedRedirect(false)).toBe("/session-expired");
  });

  it("gives_up_after_a_refresh_already_failed_to_fix_it", () => {
    expect(unauthorizedRedirect(true)).toBe("/session-expired?final=1");
  });
});
