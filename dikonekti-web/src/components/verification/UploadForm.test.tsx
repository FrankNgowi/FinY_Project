// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/fixtures";
import { UploadForm } from "./UploadForm";

const pending = { status: "pending", submitted_at: "2026-11-13T10:42:00Z", rejection_reason: "" };

function renderForm(submitLabel = "Submit for review") {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <UploadForm submitLabel={submitLabel} />
    </SWRConfig>,
  );
}
const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type });
// A person can bypass the picker's file-type filter ("All files"), so the form must not rely on it.
const user = () => userEvent.setup({ applyAccept: false });
const input = () => screen.getByLabelText(/confirmation letter or certificate/i) as HTMLInputElement;
const submit = (name = /submit for review/i) => screen.getByRole("button", { name });

afterEach(() => vi.unstubAllGlobals());

describe("UploadForm", () => {
  it("tells_the_doctor_what_is_accepted", () => {
    renderForm();
    expect(screen.getByText(/pdf, jpg or png, up to 5 mb/i)).toBeTruthy();
    expect(input().accept).toContain("application/pdf");
  });

  it.each([
    ["a_docx", () => file("letter.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "Choose a PDF, JPG or PNG file."],
    ["a_6_mb_pdf", () => file("big.pdf", "application/pdf", 6 * 1024 * 1024), "The file is larger than 5 MB."],
  ])("blocks_%s_in_the_browser_and_sends_no_request", async (_name, make, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    const u = user();
    await u.upload(input(), make());
    await u.click(submit());
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks_submitting_with_no_file_chosen", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await user().click(submit());
    expect((await screen.findByRole("alert")).textContent).toBe("Choose a PDF, JPG or PNG file.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a PDF", file("c.pdf", "application/pdf", 1024 * 1024)],
    ["a JPG", file("c.jpg", "image/jpeg")],
    ["a PNG", file("c.png", "image/png")],
  ])("uploads_%s_in_exactly_one_request", async (_label, chosen) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pending));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    const u = user();
    await u.upload(input(), chosen);
    await u.click(submit());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/verification");
    expect(init.body.get("document")).toBe(chosen);
  });

  it("sends_one_request_when_submit_is_double_clicked", async () => {
    let release: (r: Response) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    const u = user();
    await u.upload(input(), file("c.pdf", "application/pdf"));
    await u.dblClick(submit());
    await u.click(submit(/uploading/i));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(jsonResponse(pending));
  });

  it("disables_the_button_and_says_uploading_while_the_upload_runs", async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => (release = resolve))));
    renderForm();
    const u = user();
    await u.upload(input(), file("c.pdf", "application/pdf"));
    await u.click(submit());
    const busy = await screen.findByRole("button", { name: "Uploading…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    release(jsonResponse(pending));
  });

  it("shows_the_servers_message_re_enables_the_button_and_keeps_the_file_selectable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ document: ["Only PDF, JPEG or PNG files are accepted."] }, 400))
      .mockResolvedValueOnce(jsonResponse(pending));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    const u = user();
    const first = file("fake.pdf", "application/pdf");
    await u.upload(input(), first);
    await u.click(submit());
    expect((await screen.findByRole("alert")).textContent).toBe("Only PDF, JPEG or PNG files are accepted.");
    const again = submit();
    expect((again as HTMLButtonElement).disabled).toBe(false);
    expect(input().disabled).toBe(false);
    expect(input().files?.[0]).toBe(first);
    const second = file("real.pdf", "application/pdf");
    await u.upload(input(), second);
    await u.click(again);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1].body.get("document")).toBe(second);
  });

  it.each([
    [429, { detail: "Request was throttled. Expected available in 3000 seconds." }, "Too many uploads. Please wait a while and try again."],
    [413, { detail: "File too large (max 5 MB)." }, "The file is larger than 5 MB."],
  ])("explains_a_%i_in_plain_words_and_stays_usable", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, status)));
    renderForm();
    const u = user();
    await u.upload(input(), file("c.pdf", "application/pdf"));
    await u.click(submit());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(message);
    expect(alert.textContent).not.toMatch(/throttled|seconds/i);
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows_a_network_failure_and_stays_usable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderForm();
    const u = user();
    await u.upload(input(), file("c.pdf", "application/pdf"));
    await u.click(submit());
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not reach the server/i);
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
  });

  it("clears_the_old_server_error_as_soon_as_a_different_file_is_chosen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ document: ["Only PDF, JPEG or PNG files are accepted."] }, 400)));
    renderForm();
    const u = user();
    await u.upload(input(), file("fake.pdf", "application/pdf"));
    await u.click(submit());
    expect((await screen.findByRole("alert")).textContent).toBe("Only PDF, JPEG or PNG files are accepted.");
    await u.upload(input(), file("real.pdf", "application/pdf"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("clears_the_error_when_the_chosen_file_is_removed_too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Nope." }, 400)));
    renderForm();
    const u = user();
    await u.upload(input(), file("fake.pdf", "application/pdf"));
    await u.click(submit());
    await screen.findByRole("alert");
    await u.upload(input(), []);
    await waitFor(() => expect(screen.queryByText("Nope.")).toBeNull());
  });

  it("uses_the_label_it_is_given", () => {
    renderForm("Submit again");
    expect(screen.getByRole("button", { name: "Submit again" })).toBeTruthy();
  });

  it("clears_an_old_error_when_the_next_attempt_starts", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ detail: "Nope." }, 400)).mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    const u = user();
    await u.upload(input(), file("c.pdf", "application/pdf"));
    await u.click(submit());
    await screen.findByRole("alert");
    await u.click(submit());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
