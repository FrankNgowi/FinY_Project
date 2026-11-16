"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { documentFormSchema, type DocumentFormValues } from "@/lib/schemas/verification";
import { uploadErrorMessage, useUploadDocument } from "./hooks/useVerification";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function UploadForm({ submitLabel }: { submitLabel: string }) {
  const upload = useUploadDocument();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentFormValues>({ resolver: zodResolver(documentFormSchema) });
  const { pending, run } = useSingleFlight();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onValid(values: DocumentFormValues) {
    setServerError(null);
    const result = await run(() => upload(values.document));
    // On success the panel switches to "under review" and this form goes away.
    if (result && !result.ok) setServerError(uploadErrorMessage(result.error));
  }

  const message = errors.document?.message ?? serverError;

  return (
    <form onSubmit={handleSubmit(onValid, () => setServerError(null))} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="verification-document" className="text-sm font-medium text-ink">
          Confirmation letter or certificate
        </label>
        {/* A file input gives react-hook-form a FileList, so the chosen File is passed on explicitly. */}
        <Controller
          control={control}
          name="document"
          render={({ field }) => (
            <input
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              onChange={(event) => {
                // A new choice makes the last server answer about the old file out of date.
                setServerError(null);
                field.onChange(event.target.files?.[0]);
              }}
              id="verification-document"
              type="file"
              accept={ACCEPT}
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? "verification-document-error" : "verification-document-hint"}
              className="rounded-xl border border-line bg-surface p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-page file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
            />
          )}
        />
        <p id="verification-document-hint" className="text-xs text-muted">
          PDF, JPG or PNG, up to 5 MB
        </p>
        {message && (
          <p id="verification-document-error" role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-navy px-4 text-base font-semibold text-white transition-colors hover:bg-steel disabled:opacity-60 sm:self-start"
      >
        {pending ? "Uploading…" : submitLabel}
      </button>
    </form>
  );
}
