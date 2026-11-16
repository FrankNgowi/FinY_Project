// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("is_a_modal_dialog_labelled_by_its_title", () => {
    render(
      <Dialog title="Profile" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Profile" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeVisible();
  });

  it("calls_onClose_from_the_close_button", async () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Profile" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls_onClose_when_the_browser_closes_it_with_escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Profile" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );
    screen.getByRole("dialog").dispatchEvent(new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
