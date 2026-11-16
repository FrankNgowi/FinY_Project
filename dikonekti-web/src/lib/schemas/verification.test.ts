import { describe, expect, it } from "vitest";
import { CHOOSE_FILE_MESSAGE, MAX_DOCUMENT_BYTES, TOO_LARGE_MESSAGE, documentFormSchema } from "./verification";

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type });
const check = (value: unknown) => documentFormSchema.safeParse({ document: value });
const messageOf = (value: unknown) => {
  const result = check(value);
  return result.success ? null : result.error.issues[0].message;
};

describe("documentFormSchema", () => {
  it("has_the_exact_limits_and_messages_from_the_ticket", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(5 * 1024 * 1024);
    expect(CHOOSE_FILE_MESSAGE).toBe("Choose a PDF, JPG or PNG file.");
    expect(TOO_LARGE_MESSAGE).toBe("The file is larger than 5 MB.");
  });

  it.each([
    ["a.pdf", "application/pdf"],
    ["a.jpg", "image/jpeg"],
    ["a.jpeg", "image/jpeg"],
    ["a.png", "image/png"],
  ])("accepts_%s_declared_as_%s", (name, type) => {
    expect(check(file(name, type)).success).toBe(true);
  });

  it.each([["scan.PDF"], ["scan.JPG"], ["scan.jpeg"], ["scan.Png"]])(
    "falls_back_to_the_extension_when_the_browser_gives_no_type_for_%s",
    (name) => {
      expect(check(file(name, "")).success).toBe(true);
    },
  );

  it.each([
    ["letter.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["letter.doc", "application/msword"],
    ["run.exe", "application/x-msdownload"],
    ["notes.txt", "text/plain"],
    ["page.html", "text/html"],
    ["pic.gif", "image/gif"],
    ["vector.svg", "image/svg+xml"],
  ])("refuses_%s_as_the_wrong_type", (name, type) => {
    expect(messageOf(file(name, type))).toBe(CHOOSE_FILE_MESSAGE);
  });

  it("refuses_an_unknown_type_with_an_unknown_extension", () => {
    expect(messageOf(file("README", ""))).toBe(CHOOSE_FILE_MESSAGE);
    expect(messageOf(file("cert.pdf.exe", ""))).toBe(CHOOSE_FILE_MESSAGE);
  });

  it.each([[undefined], [null], [""], [{}], ["cert.pdf"], [42]])("asks_for_a_file_when_given_%j", (value) => {
    expect(messageOf(value)).toBe(CHOOSE_FILE_MESSAGE);
  });

  it("accepts_exactly_5_mb_and_refuses_one_byte_more", () => {
    expect(check(file("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES)).success).toBe(true);
    expect(messageOf(file("a.pdf", "application/pdf", MAX_DOCUMENT_BYTES + 1))).toBe(TOO_LARGE_MESSAGE);
  });

  it("refuses_a_6_mb_pdf_as_too_large", () => {
    expect(messageOf(file("a.pdf", "application/pdf", 6 * 1024 * 1024))).toBe(TOO_LARGE_MESSAGE);
  });

  it("refuses_an_empty_file", () => {
    expect(messageOf(file("a.pdf", "application/pdf", 0))).toBe("The file is empty.");
  });

  it("reports_the_wrong_type_before_the_size", () => {
    expect(messageOf(file("a.docx", "application/msword", 6 * 1024 * 1024))).toBe(CHOOSE_FILE_MESSAGE);
  });
});
