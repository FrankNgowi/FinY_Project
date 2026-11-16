import { describe, expect, it } from "vitest";
import { decideRoute, unauthorizedRedirect } from "./route-gate";

const approved = { role: "doctor", verification_status: "approved" } as const;

describe("decideRoute", () => {
  it("sends_an_approved_doctor_to_the_dashboard", () => {
    expect(decideRoute(approved)).toBe("dashboard");
  });

  it.each([["not_submitted"], ["pending"], ["rejected"]])("sends_a_doctor_with_status_%s_to_verification", (status) => {
    expect(decideRoute({ role: "doctor", verification_status: status })).toBe("verification");
  });

  it.each([[undefined], [null], [""], ["Approved"], ["approved "], ["unknown"], [1]])(
    "fails_closed_to_verification_for_a_doctor_whose_status_is_%j",
    (status) => {
      expect(decideRoute({ role: "doctor", verification_status: status } as never)).toBe("verification");
    },
  );

  it("is_case_insensitive_on_the_role_like_the_mobile_app", () => {
    expect(decideRoute({ ...approved, role: "Doctor" })).toBe("dashboard");
    expect(decideRoute({ ...approved, role: "DOCTOR" })).toBe("dashboard");
    expect(decideRoute({ role: "Doctor", verification_status: "pending" })).toBe("verification");
  });

  it("sends_a_disabled_user_to_unsupported_whatever_the_status_says", () => {
    expect(decideRoute({ role: "disabled", verification_status: null })).toBe("unsupported");
    expect(decideRoute({ role: "disabled", verification_status: "approved" })).toBe("unsupported");
  });

  it.each([[""], ["admin"], ["doctor "], ["doctors"], ["undefined"]])("sends_role_%j_to_unsupported_even_if_approved", (role) => {
    expect(decideRoute({ role, verification_status: "approved" })).toBe("unsupported");
  });

  it("sends_a_profile_without_a_role_to_unsupported", () => {
    expect(decideRoute({} as never)).toBe("unsupported");
    expect(decideRoute({ role: null } as never)).toBe("unsupported");
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
