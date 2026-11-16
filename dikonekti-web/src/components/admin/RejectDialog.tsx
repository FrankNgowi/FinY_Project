"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Dialog } from "@/components/Dialog";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { MAX_REASON_LENGTH, rejectReasonSchema, type RejectReasonValues } from "@/lib/schemas/verification";
import { DecisionConflictError, decisionErrorMessage } from "./hooks/useVerifications";

type Props = {
  doctorName: string;
  /** "Revoke approval" when the doctor is already approved, "Reject" otherwise. */
  submitLabel: "Reject" | "Revoke approval";
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
};

export function RejectDialog({ doctorName, submitLabel, onSubmit, onClose }: Props) {
  const title = submitLabel === "Revoke approval" ? `Revoke approval for ${doctorName}` : `Reject ${doctorName}'s document`;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RejectReasonValues>({ resolver: zodResolver(rejectReasonSchema), defaultValues: { reason: "" } });
  const length = (useWatch({ control, name: "reason" }) ?? "").length;
  const { pending, run } = useSingleFlight();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onValid(values: RejectReasonValues) {
    setServerError(null);
    const result = await run(() => onSubmit(values.reason), { stayLockedOnSuccess: true });
    if (!result) return;
    // Another admin already decided: the list explains it, and this dialog would vanish with its row.
    if (result.ok || result.error instanceof DecisionConflictError) onClose();
    else setServerError(decisionErrorMessage(result.error));
  }

  const message = errors.reason?.message ?? serverError;
  const field = register("reason");

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(onValid, () => setServerError(null))} noValidate className="flex flex-col gap-3">
        <label htmlFor="reject-reason" className="text-sm font-medium text-ink">
          Reason (the doctor will see this)
        </label>
        <textarea
          {...field}
          onChange={(event) => {
            setServerError(null); // an answer about the old text is out of date once it is edited
            void field.onChange(event);
          }}
          id="reject-reason"
          rows={4}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? "reject-reason-error" : undefined}
          className="rounded-xl border border-line bg-surface p-3 text-base"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-h-5 flex-1">
            {message && (
              <p id="reject-reason-error" role="alert" className="text-sm text-danger">
                {message}
              </p>
            )}
          </div>
          <span className={`shrink-0 text-xs ${length > MAX_REASON_LENGTH ? "font-semibold text-danger" : "text-muted"}`}>
            {length}/{MAX_REASON_LENGTH}
          </span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-navy px-4 text-base font-semibold text-white transition-colors hover:bg-steel disabled:opacity-60"
        >
          {pending ? "Sending…" : submitLabel}
        </button>
      </form>
    </Dialog>
  );
}
