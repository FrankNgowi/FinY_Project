import { z } from "zod";
import { AREAS, OTHERS } from "@/lib/options";

// One source of truth for the login and registration rules. The forms validate with these
// schemas and the API routes parse requests with the same ones.

export const LOGIN_BLANK_MESSAGE = "Enter your username and password.";

const required = (message: string) => z.string({ message }).trim().min(1, message);
const optionalText = z.preprocess((value) => (typeof value === "string" ? value : ""), z.string().trim());

export const loginSchema = z.object({
  username: required(LOGIN_BLANK_MESSAGE),
  password: z.string({ message: LOGIN_BLANK_MESSAGE }).min(1, LOGIN_BLANK_MESSAGE),
});
export type LoginValues = z.infer<typeof loginSchema>;

const registerShape = {
  username: required("Enter a username."),
  // Not trimmed: spaces can be part of a password, but an all-space password is rejected.
  password: z.string({ message: "Enter a password." }).refine((v) => v.trim().length > 0, "Enter a password."),
  first_name: required("Enter your first name."),
  middle_name: optionalText,
  last_name: required("Enter your last name."),
  email: optionalText,
  phone_number: required("Enter your phone number."),
  area: required("Select your area.").refine((v) => AREAS.includes(v), "Select an area from the list."),
  specialization: required("Enter your specialization."),
};

/** What the server accepts. Unknown keys (role, is_staff, ...) are dropped, never forwarded. */
export const registerPayloadSchema = z.object(registerShape);
export type RegisterPayload = z.infer<typeof registerPayloadSchema>;

/** What the browser form holds: the payload fields plus a confirmation and the "Others" text box. */
export const registerFormSchema = z
  .object({
    ...registerShape,
    // Form values are always strings, so the optional fields need no preprocessing here.
    middle_name: z.string().trim(),
    email: z.string().trim(),
    specialization: required("Select your specialization."),
    specialization_other: z.string().trim(),
    confirm_password: z.string({ message: "Confirm your password." }).min(1, "Confirm your password."),
  })
  .superRefine((values, ctx) => {
    if (values.confirm_password && values.password !== values.confirm_password) {
      ctx.addIssue({ code: "custom", path: ["confirm_password"], message: "Passwords do not match." });
    }
    if (values.specialization === OTHERS && !values.specialization_other.trim()) {
      ctx.addIssue({ code: "custom", path: ["specialization_other"], message: "Enter your specialization." });
    }
  });
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

/** Form values to the server payload: "Others" is replaced by the typed text, form-only fields dropped. */
export function toRegisterPayload(values: RegisterFormValues): RegisterPayload {
  const { confirm_password: _confirm, specialization_other: other, ...payload } = values;
  void _confirm;
  return { ...payload, specialization: values.specialization === OTHERS ? other.trim() : values.specialization };
}

/** First message per field, keyed by field name. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!result[field]) result[field] = [issue.message];
  }
  return result;
}
