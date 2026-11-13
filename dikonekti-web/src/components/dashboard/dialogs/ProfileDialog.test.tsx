// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeDoctor } from "@/test/fixtures";
import { ProfileDialog } from "./ProfileDialog";

describe("ProfileDialog", () => {
  it("shows_the_doctor_details", () => {
    render(<ProfileDialog profile={makeDoctor()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: /profile/i });
    expect(dialog).toHaveTextContent("Dr. Jane Doe");
    expect(dialog).toHaveTextContent("Cardiology");
    expect(dialog).toHaveTextContent("dr1");
    expect(dialog).toHaveTextContent("jane@example.test");
    expect(dialog).toHaveTextContent("+254700000001");
    expect(dialog).toHaveTextContent("Nairobi");
  });

  it("skips_missing_email_and_phone_and_defaults_the_rest", () => {
    render(
      <ProfileDialog
        profile={makeDoctor({ email: "", phone_number: null, area: null, specialization: null })}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveTextContent("Email");
    expect(dialog).not.toHaveTextContent("Phone");
    expect(dialog).toHaveTextContent("Not specified");
    expect(dialog).toHaveTextContent("General Practice");
  });
});
