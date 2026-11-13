"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { ApiError, apiFetch } from "@/lib/api-client";
import { AREAS, OTHERS, SPECIALIZATIONS } from "@/lib/options";
import { registerFormSchema, toRegisterPayload, type RegisterFormValues } from "@/lib/schemas/auth";

type Field = {
  name: keyof RegisterFormValues;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  options?: readonly string[];
  placeholder?: string;
};

const FIELDS: Field[] = [
  { name: "first_name", label: "First name", required: true, autoComplete: "given-name" },
  { name: "middle_name", label: "Middle name", hint: "Optional" },
  { name: "last_name", label: "Last name", required: true, autoComplete: "family-name" },
  { name: "username", label: "Username", required: true, autoComplete: "username" },
  { name: "email", label: "Email", type: "email", autoComplete: "email", hint: "Optional" },
  { name: "phone_number", label: "Phone number", type: "tel", required: true, autoComplete: "tel" },
  { name: "area", label: "Area", required: true, options: AREAS, placeholder: "Select an area" },
  { name: "specialization", label: "Specialization", required: true, options: SPECIALIZATIONS, placeholder: "Select a specialization" },
  { name: "password", label: "Password", type: "password", required: true, autoComplete: "new-password" },
  { name: "confirm_password", label: "Confirm password", type: "password", required: true, autoComplete: "new-password" },
];

// Shown only when "Others" is chosen; its text is sent as the specialization (same as the mobile app).
const OTHER_SPECIALIZATION: Field = { name: "specialization_other", label: "Specify specialization", required: true };

const controlClass = "h-11 rounded-xl border border-line bg-surface px-3 text-base";
const EMPTY: RegisterFormValues = {
  first_name: "",
  middle_name: "",
  last_name: "",
  username: "",
  email: "",
  phone_number: "",
  area: "",
  specialization: "",
  specialization_other: "",
  password: "",
  confirm_password: "",
};

function isFormValue(name: string): name is keyof RegisterFormValues {
  return name in EMPTY;
}

export function RegisterForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerFormSchema), defaultValues: EMPTY });
  const { pending, run } = useSingleFlight();
  const [formError, setFormError] = useState<string | null>(null);

  const specialization = useWatch({ control, name: "specialization" });
  const fields = FIELDS.flatMap((field) => (field.name === "specialization" && specialization === OTHERS ? [field, OTHER_SPECIALIZATION] : [field]));

  async function onValid(values: RegisterFormValues) {
    setFormError(null);
    const result = await run(
      () => apiFetch("auth/register", { method: "POST", body: toRegisterPayload(values), redirectOnUnauthorized: false }),
      { stayLockedOnSuccess: true },
    );
    if (!result) return;
    if (result.ok) {
      router.replace("/");
      return;
    }
    const error = result.error;
    const body = error instanceof ApiError ? (error.body as { errors?: Record<string, string[]> } | undefined) : undefined;
    const serverErrors = body?.errors ?? {};
    let fieldCount = 0;
    for (const [name, messages] of Object.entries(serverErrors)) {
      if (name === "form" || !isFormValue(name) || messages.length === 0) continue;
      // The free-text box replaces the dropdown's value when "Others" is chosen.
      const target = name === "specialization" && values.specialization === OTHERS ? "specialization_other" : name;
      setError(target, { type: "server", message: messages.join(" ") });
      fieldCount += 1;
    }
    setFormError(serverErrors.form?.[0] ?? (fieldCount > 0 ? null : error instanceof Error ? error.message : "Something went wrong. Please try again."));
  }

  return (
    <form onSubmit={handleSubmit(onValid, () => setFormError(null))} noValidate className="flex flex-col gap-4">
      {formError && (
        <p role="alert" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-orange-900">
          {formError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const message = errors[field.name]?.message;
          const id = `register-${field.name}`;
          const describedBy = message ? `${id}-error` : field.hint ? `${id}-hint` : undefined;
          const common = {
            id,
            "aria-required": field.required,
            "aria-invalid": message ? true : undefined,
            "aria-describedby": describedBy,
            className: controlClass,
          } as const;
          return (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium text-ink">
                {field.label}
              </label>
              {field.options ? (
                <select {...register(field.name)} {...common}>
                  <option value="">{field.placeholder}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...register(field.name)}
                  {...common}
                  type={field.type ?? "text"}
                  autoComplete={field.autoComplete}
                  autoCapitalize={field.name === "username" ? "none" : undefined}
                />
              )}
              {message ? (
                <p id={`${id}-error`} className="text-sm text-danger">
                  {message}
                </p>
              ) : (
                field.hint && (
                  <p id={`${id}-hint`} className="text-xs text-muted">
                    {field.hint}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-navy px-4 text-base font-semibold text-white transition-colors hover:bg-steel disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-steel underline underline-offset-2">
          Log in
        </Link>
      </p>
    </form>
  );
}
