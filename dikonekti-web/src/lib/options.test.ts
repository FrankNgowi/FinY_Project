import { describe, expect, it } from "vitest";
import { AREAS, OTHERS, SPECIALIZATIONS } from "./options";

describe("sign-up options", () => {
  it("areas_have_no_duplicates_and_end_with_others", () => {
    expect(new Set(AREAS).size).toBe(AREAS.length);
    expect(AREAS.at(-1)).toBe(OTHERS);
  });

  it("areas_match_the_mobile_app_values_exactly", () => {
    // Stored values must equal what patients pick in the mobile app, including its spelling.
    expect(AREAS).toContain("Stone Town");
    expect(AREAS).toContain("jumbi");
    expect(AREAS).toContain("Mtoni Kijichi");
    expect(AREAS).toHaveLength(21);
  });

  it("specializations_match_the_mobile_app", () => {
    expect(SPECIALIZATIONS).toEqual(["Vision", "Hearing", "Body Impairment", "Others"]);
  });
});
