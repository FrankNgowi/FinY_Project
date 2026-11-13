import { describe, expect, it } from "vitest";
import {
  LOGIN_BLANK_MESSAGE,
  loginSchema,
  registerFormSchema,
  registerPayloadSchema,
  toRegisterPayload,
  zodFieldErrors,
} from "./auth";

const validPayload = {
  username: "dr_new",
  password: "Str0ng#Pass2026",
  first_name: "Neema",
  middle_name: "",
  last_name: "Kariuki",
  email: "",
  phone_number: "+254700123123",
  area: "Stone Town",
  specialization: "Vision",
};
const validForm = { ...validPayload, confirm_password: "Str0ng#Pass2026", specialization_other: "" };

const errors = (schema: { safeParse: (v: unknown) => { success: boolean; error?: never } | { success: false; error: unknown } }, value: unknown) => {
  const result = schema.safeParse(value) as { success: boolean; error?: Parameters<typeof zodFieldErrors>[0] };
  return result.success ? {} : zodFieldErrors(result.error!);
};

describe("loginSchema", () => {
  it("trims_the_username_but_keeps_the_password_exactly", () => {
    expect(loginSchema.parse({ username: "  dr1 ", password: " pw " })).toEqual({ username: "dr1", password: " pw " });
  });

  it.each([
    [{ username: "", password: "pw" }],
    [{ username: "   ", password: "pw" }],
    [{ username: "dr1", password: "" }],
    [{ username: "dr1" }],
    [{ password: "pw" }],
    [{ username: 5, password: {} }],
    [{}],
  ])("rejects_%j_with_the_single_blank_message", (value) => {
    const result = loginSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(Object.values(errors(loginSchema, value)).flat()).toContain(LOGIN_BLANK_MESSAGE);
  });

  it.each([[null], ["str"], [[]], [undefined]])("rejects_a_non_object_%j", (value) => {
    expect(loginSchema.safeParse(value).success).toBe(false);
  });
});

describe("registerPayloadSchema", () => {
  it("accepts_a_valid_payload", () => {
    expect(registerPayloadSchema.parse(validPayload)).toEqual(validPayload);
  });

  it("trims_text_but_not_the_password_and_defaults_optional_fields_to_empty", () => {
    const parsed = registerPayloadSchema.parse({ ...validPayload, username: " dr_new ", area: " Stone Town ", password: " pw pw ", email: undefined, middle_name: 5 });
    expect(parsed).toMatchObject({ username: "dr_new", area: "Stone Town", password: " pw pw ", email: "", middle_name: "" });
  });

  it("strips_fields_the_client_must_not_control", () => {
    const parsed = registerPayloadSchema.parse({ ...validPayload, role: "disabled", is_staff: true, is_superuser: true, registered_doctor_username: "x", id: 1 });
    expect(Object.keys(parsed).sort()).toEqual(
      ["area", "email", "first_name", "last_name", "middle_name", "password", "phone_number", "specialization", "username"],
    );
  });

  it.each(["username", "password", "first_name", "last_name", "phone_number", "area", "specialization"])(
    "reports_exactly_one_message_for_a_missing_blank_or_non_string_%s",
    (field) => {
      for (const value of [undefined, "", "   ", { x: 1 }, 5]) {
        const found = errors(registerPayloadSchema, { ...validPayload, [field]: value });
        expect(found[field]).toHaveLength(1);
      }
    },
  );

  it.each([["Nairobi"], ["stone town"], ["Stone Town; drop"], ["<script>"]])("rejects_an_area_outside_the_list_%s", (area) => {
    expect(errors(registerPayloadSchema, { ...validPayload, area }).area).toEqual([expect.stringMatching(/select/i)]);
  });

  it("accepts_others_as_an_area_and_free_text_as_a_specialization", () => {
    expect(registerPayloadSchema.safeParse({ ...validPayload, area: "Others", specialization: "Autism care" }).success).toBe(true);
  });
});

describe("registerFormSchema", () => {
  it("accepts_a_valid_form", () => {
    expect(registerFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("flags_mismatched_passwords_on_the_confirmation_field", () => {
    expect(errors(registerFormSchema, { ...validForm, confirm_password: "nope" }).confirm_password).toEqual(["Passwords do not match."]);
  });

  it("asks_to_confirm_an_empty_confirmation_with_natural_wording", () => {
    expect(errors(registerFormSchema, { ...validForm, confirm_password: "" }).confirm_password).toEqual(["Confirm your password."]);
  });

  it("requires_the_free_text_box_only_when_others_is_chosen", () => {
    expect(registerFormSchema.safeParse({ ...validForm, specialization: "Hearing", specialization_other: "" }).success).toBe(true);
    expect(errors(registerFormSchema, { ...validForm, specialization: "Others", specialization_other: "  " }).specialization_other).toEqual([
      "Enter your specialization.",
    ]);
  });

  it("uses_select_wording_for_the_dropdowns", () => {
    const found = errors(registerFormSchema, { ...validForm, area: "", specialization: "" });
    expect(found.area).toEqual(["Select your area."]);
    expect(found.specialization).toEqual(["Select your specialization."]);
  });
});

describe("toRegisterPayload", () => {
  it("drops_form_only_fields", () => {
    const payload = toRegisterPayload(registerFormSchema.parse(validForm));
    expect(payload).toEqual(validPayload);
    expect(payload).not.toHaveProperty("confirm_password");
    expect(payload).not.toHaveProperty("specialization_other");
  });

  it("sends_the_free_text_as_the_specialization_when_others_is_chosen", () => {
    const payload = toRegisterPayload(registerFormSchema.parse({ ...validForm, specialization: "Others", specialization_other: " Autism care " }));
    expect(payload.specialization).toBe("Autism care");
  });
});

describe("zodFieldErrors", () => {
  it("keeps_only_the_first_message_per_field", () => {
    const found = errors(registerPayloadSchema, { ...validPayload, area: "" });
    expect(found.area).toHaveLength(1);
  });
});
