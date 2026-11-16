import { z } from "zod";

// The browser checks the file before sending so a wrong choice never costs an upload. These are
// conveniences: Django checks the real bytes and stays the authority.

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const CHOOSE_FILE_MESSAGE = "Choose a PDF, JPG or PNG file.";
export const TOO_LARGE_MESSAGE = "The file is larger than 5 MB.";
export const EMPTY_FILE_MESSAGE = "The file is empty.";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXTENSION = /\.(pdf|jpe?g|png)$/i;

/** The browser's own type when it gives one; the extension only when it gives none. */
function hasAllowedType(file: File): boolean {
  const type = file.type.trim().toLowerCase();
  return type ? ALLOWED_TYPES.has(type) : ALLOWED_EXTENSION.test(file.name);
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
