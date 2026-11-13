import { describe, expect, it } from "vitest";
import { extractFieldErrors } from "./field-errors";

describe("extractFieldErrors", () => {
  it("maps_drf_field_errors_to_string_arrays", () => {
    expect(extractFieldErrors({ username: ["A user with that username already exists."], password: ["Too short.", "Too common."] })).toEqual({
      username: ["A user with that username already exists."],
      password: ["Too short.", "Too common."],
    });
  });

  it("accepts_a_single_string_value", () => {
    expect(extractFieldErrors({ area: "Area is required." })).toEqual({ area: ["Area is required."] });
  });

  it("maps_non_field_and_detail_errors_to_form", () => {
    expect(extractFieldErrors({ non_field_errors: ["Nope."] })).toEqual({ form: ["Nope."] });
    expect(extractFieldErrors({ detail: "Denied." })).toEqual({ form: ["Denied."] });
  });

  it("drops_non_string_entries_and_empty_fields", () => {
    expect(extractFieldErrors({ a: [1, null, "ok"], b: [], c: {}, d: 5 })).toEqual({ a: ["ok"] });
  });

  it.each([[null], [undefined], ["text"], [42], [[]], [{}]])("returns_an_empty_map_for_%j", (body) => {
    expect(extractFieldErrors(body)).toEqual({});
  });
});
