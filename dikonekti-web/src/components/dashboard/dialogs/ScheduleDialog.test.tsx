// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeAppointment } from "@/test/fixtures";
import { ScheduleDialog } from "./ScheduleDialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

function renderDialog() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <ScheduleDialog onClose={vi.fn()} />
    </SWRConfig>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ScheduleDialog", () => {
  it("lists_requests_with_status_text_and_actions_only_for_pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        jsonResponse([
          makeAppointment({ id: 1, patient_name: "Amina Otieno", status: "pending", reason: "Check-up" }),
          makeAppointment({ id: 2, patient_name: "Brian Kamau", status: "confirmed", reason: "" }),
          makeAppointment({ id: 3, patient_name: "Cynthia Njeri", status: "declined" }),
        ]),
      ),
    );
    renderDialog();
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Pending")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Check-up")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: /decline/i })).toBeInTheDocument();
    expect(within(rows[1]).getByText("Confirmed")).toBeInTheDocument();
    expect(within(rows[1]).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rows[2]).getByText("Declined")).toBeInTheDocument();
    expect(within(rows[2]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows_the_empty_state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse([])));
    renderDialog();
    expect(await screen.findByText(/no appointment requests/i)).toBeInTheDocument();
  });

  it("shows_an_error_when_loading_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ detail: "boom" }, 500)));
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/no appointment requests/i)).not.toBeInTheDocument();
  });

  it("confirms_a_request_and_updates_the_row", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([makeAppointment({ id: 4, status: "pending" })]))
      .mockImplementationOnce(async () => jsonResponse(makeAppointment({ id: 4, status: "confirmed" })));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: /confirm/i }));
    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/appointments/4/status");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "confirmed" });
  });

  it("declines_a_request", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([makeAppointment({ id: 5, status: "pending" })]))
      .mockImplementationOnce(async () => jsonResponse(makeAppointment({ id: 5, status: "declined" })));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: /decline/i }));
    expect(await screen.findByText("Declined")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ status: "declined" });
  });

  it("keeps_the_row_pending_and_shows_a_row_error_when_the_update_fails", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([makeAppointment({ id: 6, status: "pending" })]))
      .mockImplementationOnce(async () => jsonResponse({ detail: "You do not have permission." }, 403));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: /confirm/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/you do not have permission/i);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("copes_with_an_invalid_requested_time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse([makeAppointment({ requested_time: "garbage" })])));
    renderDialog();
    expect(await screen.findByText("Unknown time")).toBeInTheDocument();
  });
});
