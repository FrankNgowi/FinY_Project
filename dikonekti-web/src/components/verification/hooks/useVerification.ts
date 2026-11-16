"use client";

import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ApiError, apiFetch, swrFetcher } from "@/lib/api-client";
import { TOO_LARGE_MESSAGE } from "@/lib/schemas/verification";
import type { VerificationRecord } from "@/lib/types";

export const VERIFICATION_KEY = "me/verification/";
export const VERIFICATION_POLL_MS = 30_000;
export const TOO_MANY_UPLOADS_MESSAGE = "Too many uploads. Please wait a while and try again.";

/**
 * A document waiting for review is the only state that changes on its own, so only it is polled.
 * This is an effect on the current status rather than an SWR refresh interval: SWR schedules its
 * next refresh only after a request, so a status written straight into the cache by an upload
 * would never be checked again.
 */
export function useVerification() {
  const swr = useSWR(VERIFICATION_KEY, swrFetcher<VerificationRecord>, { revalidateOnFocus: true });
  const { mutate } = swr;
  const pending = swr.data?.status === "pending";

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      // A hidden tab is not looking at the page; it checks again as soon as it is shown (focus revalidation).
      if (document.visibilityState === "visible") void mutate();
    }, VERIFICATION_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, mutate]);

  return swr;
}

/** Sends the file unchanged in a form field named `document`. The browser adds the multipart header. */
export function uploadDocument(file: File): Promise<VerificationRecord> {
  const form = new FormData();
  form.append("document", file);
  return apiFetch<VerificationRecord>(VERIFICATION_KEY, { method: "POST", body: form });
}

/** Uploads and puts the new record straight into the cache, so the panel changes without another request. */
export function useUploadDocument() {
  const { mutate } = useSWRConfig();
  return async function upload(file: File): Promise<VerificationRecord> {
    const record = await uploadDocument(file);
    await mutate(VERIFICATION_KEY, record, { revalidate: false });
    return record;
  };
}

/**
 * Plain words for the two refusals whose raw text means nothing to a doctor (Django's throttling
 * message talks about seconds). Anything else shows the server's own message.
 */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return TOO_LARGE_MESSAGE;
    if (error.status === 429) return TOO_MANY_UPLOADS_MESSAGE;
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
