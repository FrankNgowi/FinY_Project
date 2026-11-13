// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeHeader } from "./WelcomeHeader";

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("WelcomeHeader", () => {
  it("greets_by_time_of_day_after_mount", async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 9, 0, 0));
    await act(async () => {
      render(<WelcomeHeader displayName="Dr. Jane Doe" activeAlertCount={0} />);
    });
    expect(screen.getByText("Good morning,")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Jane Doe" })).toBeInTheDocument();
  });

  it.each([
    [0, "All patients are stable"],
    [1, "1 active alert"],
    [2, "2 active alerts"],
  ])("with_%i_active_alerts_shows_%s", async (count, text) => {
    await act(async () => {
      render(<WelcomeHeader displayName="Dr. Jane Doe" activeAlertCount={count} />);
    });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("does_not_claim_patients_are_stable_while_alerts_are_unknown", async () => {
    await act(async () => {
      render(<WelcomeHeader displayName="Dr. Jane Doe" activeAlertCount={null} />);
    });
    expect(screen.queryByText(/all patients are stable/i)).not.toBeInTheDocument();
  });
});
