// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { DecisionConflictError } from "./hooks/useVerifications";
import { RejectDialog } from "./RejectDialog";

function renderDialog(props: Partial<Parameters<typeof RejectDialog>[0]> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  render(<RejectDialog doctorName="Dr. Jane Doe" submitLabel="Reject" {...props} onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit: onSubmit as ReturnType<typeof vi.fn>, onClose: onClose as ReturnType<typeof vi.fn> };
}
const box = () => screen.getByLabelText(/reason/i) as HTMLTextAreaElement;
const send = (name: RegExp | string = "Reject") => screen.getByRole("button", { name });

afterEach(() => vi.restoreAllMocks());

describe("RejectDialog", () => {
  it("names_the_doctor_and_explains_who_reads_the_reason", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: /dr\. jane doe/i })).toBeInTheDocument();
    expect(screen.getByText(/the doctor will see this/i)).toBeInTheDocument();
  });

  it("shows_a_live_counter_out_of_500", async () => {
    renderDialog();
    expect(screen.getByText("0/500")).toBeInTheDocument();
    await userEvent.type(box(), "abc");
    expect(screen.getByText("3/500")).toBeInTheDocument();
  });

  it.each([[""], ["   "], ["\n  \n"]])("blocks_the_reason_%j_and_sends_nothing", async (text) => {
    const { onSubmit } = renderDialog();
    if (text) await userEvent.type(box(), text);
    await userEvent.click(send());
    expect((await screen.findByRole("alert")).textContent).toBe("Enter a reason.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks_501_characters_with_a_clear_message_and_allows_exactly_500", async () => {
    const { onSubmit } = renderDialog();
    await userEvent.click(box());
    await userEvent.paste("x".repeat(501));
    await userEvent.click(send());
    expect((await screen.findByRole("alert")).textContent).toBe("The reason must be 500 characters or fewer.");
    expect(screen.getByText("501/500")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.clear(box());
    await userEvent.paste("x".repeat(500));
    await userEvent.click(send());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("sends_the_trimmed_reason_once_and_then_closes", async () => {
    const { onSubmit, onClose } = renderDialog();
    await userEvent.type(box(), "  The scan is blurry.  ");
    await userEvent.click(send());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("The scan is blurry.");
  });

  it("sends_one_request_when_the_button_is_double_clicked_and_is_disabled_meanwhile", async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    renderDialog({ onSubmit });
    await userEvent.type(box(), "No licence");
    await userEvent.dblClick(send());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: /sending/i }) as HTMLButtonElement).disabled).toBe(true);
    release();
  });

  it("uses_the_revoke_label_for_an_approved_doctor", () => {
    renderDialog({ submitLabel: "Revoke approval" });
    expect(screen.getByRole("button", { name: "Revoke approval" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /revoke approval/i })).toBeInTheDocument();
  });

  it("shows_the_servers_message_stays_open_and_can_try_again", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new ApiError(0, "Could not reach the server.")).mockResolvedValue(undefined);
    const { onClose } = renderDialog({ onSubmit });
    await userEvent.type(box(), "No licence");
    await userEvent.click(send());
    expect((await screen.findByRole("alert")).textContent).toBe("Could not reach the server.");
    expect(onClose).not.toHaveBeenCalled();
    expect(box().value).toBe("No licence");
    expect((send() as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(send());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("closes_without_its_own_message_when_another_admin_already_decided", async () => {
    // The list explains the conflict; this dialog would vanish with its row, so it just stands down.
    const onSubmit = vi.fn().mockRejectedValue(new DecisionConflictError());
    const { onClose } = renderDialog({ onSubmit });
    await userEvent.type(box(), "No licence");
    await userEvent.click(send());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears_the_old_server_error_when_the_reason_is_edited", async () => {
    renderDialog({ onSubmit: vi.fn().mockRejectedValue(new ApiError(400, "Nope.")) });
    await userEvent.type(box(), "x");
    await userEvent.click(send());
    await screen.findByRole("alert");
    await userEvent.type(box(), "y");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("sends_nothing_when_closed_with_the_close_button", async () => {
    const { onSubmit, onClose } = renderDialog();
    await userEvent.type(box(), "typed but not sent");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps_markup_as_plain_text", async () => {
    const { onSubmit } = renderDialog();
    await userEvent.type(box(), "<img src=x onerror=alert(1)>", { skipClick: false });
    await userEvent.click(send());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("<img src=x onerror=alert(1)>"));
  });
});
