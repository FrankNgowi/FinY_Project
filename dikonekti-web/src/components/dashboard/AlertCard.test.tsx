// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeAlert } from "@/test/fixtures";
import { AlertCard } from "./AlertCard";

describe("AlertCard", () => {
  it("shows_acknowledge_only_for_active_alerts", () => {
    const { rerender } = render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
    expect(screen.getByRole("button", { name: /acknowledge alert from amina otieno/i })).toBeInTheDocument();
    expect(screen.getByText(/needs urgent help/i)).toBeInTheDocument();
    rerender(<AlertCard alert={makeAlert({ acknowledged: true })} onAcknowledge={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /acknowledge/i })).not.toBeInTheDocument();
    expect(screen.getByText(/marked resolved/i)).toBeInTheDocument();
  });

  it("shows_status_as_text_not_only_color", () => {
    render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
    expect(screen.getByText(/needs urgent help/i)).toBeVisible();
  });

  it("shows_disability_and_area_and_a_call_link", () => {
    render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
    expect(screen.getByTestId("alert-meta")).toHaveTextContent("Vision · Kibera");
    expect(screen.getByRole("link", { name: /call amina otieno/i })).toHaveAttribute("href", "tel:+254700111222");
  });

  it("hides_the_call_chip_and_meta_when_phone_area_and_type_are_missing", () => {
    render(
      <AlertCard
        alert={makeAlert({ patient_phone_number: "  ", patient_area: null, disability_type: null })}
        onAcknowledge={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("alert-meta")).not.toBeInTheDocument();
  });

  it("shows_coordinates_with_a_safe_map_link", () => {
    render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
    expect(screen.getByText("-1.28639, 36.81722")).toBeInTheDocument();
    const map = screen.getByRole("link", { name: /open in google maps/i });
    expect(map).toHaveAttribute("href", "https://www.google.com/maps/search/?api=1&query=-1.28639,36.81722");
    expect(map).toHaveAttribute("target", "_blank");
    expect(map).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(map).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  it("treats_zero_zero_as_a_real_location", () => {
    render(<AlertCard alert={makeAlert({ latitude: 0, longitude: 0 })} onAcknowledge={vi.fn()} />);
    expect(screen.getByText("0.00000, 0.00000")).toBeInTheDocument();
    expect(screen.queryByText(/location unavailable/i)).not.toBeInTheDocument();
  });

  it("explains_a_missing_location_with_the_reported_error", () => {
    render(
      <AlertCard
        alert={makeAlert({ latitude: null, longitude: null, location_error: "Location permission denied" })}
        onAcknowledge={vi.fn()}
      />,
    );
    expect(screen.getByText(/location unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("Location permission denied")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google maps/i })).not.toBeInTheDocument();
  });

  it("copies_the_coordinates_and_confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /copy coordinates/i }));
    expect(writeText).toHaveBeenCalledWith("-1.28639, 36.81722");
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  it("does_not_crash_when_the_clipboard_is_unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /copy coordinates/i }));
    expect(await screen.findByText(/could not copy/i)).toBeInTheDocument();
  });

  it("disables_the_button_while_acknowledging_and_ignores_double_clicks", async () => {
    let resolve!: () => void;
    const onAcknowledge = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    render(<AlertCard alert={makeAlert({ id: 9 })} onAcknowledge={onAcknowledge} />);
    const button = screen.getByRole("button", { name: /acknowledge alert/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
    expect(onAcknowledge).toHaveBeenCalledWith(9);
    expect(button).toBeDisabled();
    resolve();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("shows_the_error_and_stays_active_when_acknowledge_fails", async () => {
    const onAcknowledge = vi.fn().mockRejectedValue(new Error("You do not have permission."));
    render(<AlertCard alert={makeAlert()} onAcknowledge={onAcknowledge} />);
    await userEvent.click(screen.getByRole("button", { name: /acknowledge alert/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not acknowledge.*you do not have permission/i);
    expect(screen.getByRole("button", { name: /acknowledge alert/i })).toBeEnabled();
  });

  it("copes_with_a_very_long_patient_name", () => {
    const name = "Alexandria ".repeat(20).trim();
    render(<AlertCard alert={makeAlert({ patient_name: name })} onAcknowledge={vi.fn()} />);
    expect(screen.getByRole("heading", { name })).toHaveClass("break-words");
  });

  describe("copy status", () => {
    afterEach(() => vi.useRealTimers());

    it("clears_the_copied_message_after_a_moment", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
      render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: /copy coordinates/i }));
      expect(await screen.findByText("Copied")).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });
      expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    });

    it("clears_a_failed_copy_message_too", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: /copy coordinates/i }));
      expect(await screen.findByText(/could not copy/i)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_500);
      });
      expect(screen.queryByText(/could not copy/i)).not.toBeInTheDocument();
    });
  });

  describe("alert age", () => {
    afterEach(() => vi.useRealTimers());

    it("keeps_advancing_without_new_data_while_the_page_stays_open", () => {
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
      render(<AlertCard alert={makeAlert({ timestamp: "2026-11-13T12:00:00Z" })} onAcknowledge={vi.fn()} />);
      expect(screen.getByText(/just now/i)).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(65_000);
      });
      expect(screen.getByText(/1m ago/i)).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      });
      expect(screen.getByText(/2h ago/i)).toBeInTheDocument();
    });

    it("stops_its_timer_when_the_card_unmounts", () => {
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      const { unmount } = render(<AlertCard alert={makeAlert()} onAcknowledge={vi.fn()} />);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("many_cards_share_one_timer", () => {
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      render(
        <>
          <AlertCard alert={makeAlert({ id: 1 })} onAcknowledge={vi.fn()} />
          <AlertCard alert={makeAlert({ id: 2 })} onAcknowledge={vi.fn()} />
          <AlertCard alert={makeAlert({ id: 3 })} onAcknowledge={vi.fn()} />
        </>,
      );
      expect(vi.getTimerCount()).toBe(1);
    });
  });
});
