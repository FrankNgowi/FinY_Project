import { z } from "zod";

// The browser checks the file before sending so a wrong choice never costs an upload. These are
// conveniences: Django checks the real bytes and stays the authority.

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const CHOOSE_FILE_MESSAGE = "Choose a PDF, JPG or PNG file.";
export const TOO_LARGE_MESSAGE = "The file is larger than 5 MB.";
export const EMPTY_FILE_MESSAGE = "The file is empty.";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXTENSION = /\.(pdf|jpe?g|png)$/i;

/** A browser that does not recognise the file reports no type, or this generic one. */
const GENERIC_TYPE = "application/octet-stream";

/**
 * The browser's own type when it gives a specific one; the extension when it gives none or only
 * the generic type. A clearly wrong type (such as text/html) is never rescued by the extension.
 */
function hasAllowedType(file: File): boolean {
  const type = file.type.trim().toLowerCase();
  return type && type !== GENERIC_TYPE ? ALLOWED_TYPES.has(type) : ALLOWED_EXTENSION.test(file.name);
}

export const documentFormSchema = z.object({
  document: z
    .custom<File>((value) => value instanceof File, { message: CHOOSE_FILE_MESSAGE })
    .superRefine((file, ctx) => {
      // One message at a time, in the order a person would fix them.
      const problem = !hasAllowedType(file)
        ? CHOOSE_FILE_MESSAGE
        : file.size === 0
          ? EMPTY_FILE_MESSAGE
          : file.size > MAX_DOCUMENT_BYTES
            ? TOO_LARGE_MESSAGE
            : null;
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
});
export type DocumentFormValues = z.infer<typeof documentFormSchema>;

export const MAX_REASON_LENGTH = 500;
export const REASON_REQUIRED_MESSAGE = "Enter a reason.";
export const REASON_TOO_LONG_MESSAGE = `The reason must be ${MAX_REASON_LENGTH} characters or fewer.`;

/** An admin's reason for rejecting a certificate or revoking an approval. The doctor reads it. */
export const rejectReasonSchema = z.object({
  reason: z
    .string({ message: REASON_REQUIRED_MESSAGE })
    .trim()
    .min(1, REASON_REQUIRED_MESSAGE)
    .max(MAX_REASON_LENGTH, REASON_TOO_LONG_MESSAGE),
});
export type RejectReasonValues = z.infer<typeof rejectReasonSchema>;
