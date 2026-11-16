// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { makeAdminVerification } from "@/test/fixtures";
import type { AdminVerification } from "@/lib/types";
import { DecisionConflictError } from "./hooks/useVerifications";
import { VerificationRow } from "./VerificationRow";

type Options = { showStatus?: boolean; onApprove?: ReturnType<typeof vi.fn>; onReject?: ReturnType<typeof vi.fn> };

function renderRow(record: Partial<AdminVerification> = {}, options: Options = {}) {
  const onApprove = options.onApprove ?? vi.fn().mockResolvedValue(undefined);
  const onReject = options.onReject ?? vi.fn().mockResolvedValue(undefined);
  render(
    <ul>
      <VerificationRow
        record={makeAdminVerification(record)}
        showStatus={options.showStatus ?? false}
        onApprove={onApprove as unknown as (id: number) => Promise<unknown>}
        onReject={onReject as unknown as (id: number, reason: string) => Promise<unknown>}
      />
    </ul>,
  );
  return { onApprove, onReject };
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

describe("VerificationRow details", () => {
  it("shows_who_the_doctor_is_and_how_to_reach_them", () => {
    renderRow({ submitted_at: hoursAgo(2), email: "jane@example.test", phone_number: "+254700000001" });
    expect(screen.getByText("Dr. Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/vision/i)).toBeInTheDocument();
    expect(screen.getByText(/stone town/i)).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.test/)).toBeInTheDocument();
    expect(screen.getByText(/username:/i)).toHaveTextContent("Username: jane");
    expect(screen.getByRole("link", { name: /call dr\. jane doe/i })).toHaveAttribute("href", "tel:+254700000001");
  });

  it("shows_the_time_submitted_in_words", () => {
    renderRow({ submitted_at: hoursAgo(2) });
    expect(screen.getByText(/submitted 2h ago/i)).toBeInTheDocument();
  });

  it("reads_as_one_sentence_when_the_request_was_just_submitted", () => {
    renderRow({ submitted_at: new Date().toISOString() });
    expect(screen.getByText("Submitted just now")).toBeInTheDocument();
  });

  it("copes_with_missing_optional_details", () => {
    renderRow({ specialization: null, area: null, phone_number: null, email: "" });
    expect(screen.getByText("Dr. Jane Doe")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /call/i })).toBeNull();
  });

  it("shows_markup_in_a_name_as_plain_text", () => {
    const { container } = render(
      <ul>
        <VerificationRow record={makeAdminVerification({ display_name: "<img src=x onerror=alert(1)>" })} showStatus={false} onApprove={vi.fn()} onReject={vi.fn()} />
      </ul>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });

  it.each([["approved", "Approved"], ["rejected", "Rejected"], ["not_submitted", "Not submitted"], ["pending", "Pending"]])(
    "shows_the_%s_badge_only_when_asked_to",
    (status, label) => {
      renderRow({ status: status as never }, { showStatus: true });
      expect(screen.getByText(label, { selector: "[data-status]" })).toBeInTheDocument();
    },
  );

  it("hides_the_badge_inside_the_pending_tab", () => {
    renderRow({ status: "pending" }, { showStatus: false });
    expect(document.querySelector("[data-status]")).toBeNull();
  });

  it("shows_the_reviewers_reason_on_a_rejected_row", () => {
    renderRow({ status: "rejected", rejection_reason: "Name does not match." }, { showStatus: true });
    expect(screen.getByText(/reason: name does not match\./i)).toBeInTheDocument();
  });
});

describe("VerificationRow actions by status", () => {
  const buttons = () => screen.queryAllByRole("button").map((b) => b.textContent);

  it("lets_an_admin_view_approve_or_reject_a_pending_request", () => {
    renderRow({ status: "pending" });
    expect(buttons()).toEqual(["Approve", "Reject"]);
    expect(screen.getByRole("link", { name: "View document" })).toBeInTheDocument();
  });

  it("only_lets_an_admin_revoke_an_approved_doctor", () => {
    renderRow({ status: "approved" }, { showStatus: true });
    expect(buttons()).toEqual(["Revoke approval"]);
    expect(screen.getByRole("link", { name: "View document" })).toBeInTheDocument();
  });

  it("only_lets_an_admin_view_the_document_of_a_rejected_request", () => {
    renderRow({ status: "rejected" }, { showStatus: true });
    expect(buttons()).toEqual([]);
    expect(screen.getByRole("link", { name: "View document" })).toBeInTheDocument();
  });

  it("offers_nothing_for_a_doctor_who_never_uploaded_anything", () => {
    renderRow({ status: "not_submitted", submitted_at: null }, { showStatus: true });
    expect(buttons()).toEqual([]);
    expect(screen.queryByRole("link", { name: "View document" })).toBeNull();
    expect(screen.getByText(/no document yet/i)).toBeInTheDocument();
  });

  it("opens_the_document_in_a_new_tab_through_the_same_origin_proxy_without_a_token_in_the_address", () => {
    renderRow({ id: 42 });
    const link = screen.getByRole("link", { name: "View document" });
    expect(link).toHaveAttribute("href", "/api/admin/verifications/42/document");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
    expect(link.getAttribute("href")).not.toMatch(/token|access|\?/i);
  });
});

describe("VerificationRow decisions", () => {
  it("approves_with_one_request_even_when_double_clicked", async () => {
    let release: () => void = () => {};
    const onApprove = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    renderRow({ id: 7 }, { onApprove });
    await userEvent.dblClick(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith(7);
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true);
    release();
  });

  it("shows_the_failure_and_enables_the_buttons_again", async () => {
    const onApprove = vi.fn().mockRejectedValue(new ApiError(0, "Could not reach the server. Check your connection and try again."));
    renderRow({}, { onApprove });
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/could not reach the server/i);
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("leaves_a_conflict_to_the_list_which_outlives_the_row_and_enables_the_buttons_again", async () => {
    const onApprove = vi.fn().mockRejectedValue(new DecisionConflictError());
    renderRow({}, { onApprove });
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens_the_reject_dialog_and_sends_the_reason_for_this_record", async () => {
    const { onReject } = renderRow({ id: 9 });
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/reason/i), "Not legible");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith(9, "Not legible"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("labels_the_dialog_for_an_approved_doctor_as_a_revocation", async () => {
    renderRow({ status: "approved" }, { showStatus: true });
    await userEvent.click(screen.getByRole("button", { name: "Revoke approval" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Revoke approval" })).toBeInTheDocument();
  });

  it("does_not_send_anything_when_the_dialog_is_cancelled", async () => {
    const { onReject } = renderRow();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(onReject).not.toHaveBeenCalled();
  });
});
