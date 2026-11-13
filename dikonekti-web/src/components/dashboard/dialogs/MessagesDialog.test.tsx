// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeMessage, makeProfile } from "@/test/fixtures";
import { MessagesDialog } from "./MessagesDialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const patients = [
  makeProfile({ username: "p1", first_name: "Amina", last_name: "Otieno", area: "Kibera" }),
  makeProfile({ username: "p2", first_name: "Brian", last_name: "Kamau", area: null }),
];

// `null` renders the dialog as if the patient list could not be loaded (patients === undefined).
function renderDialog(list: typeof patients | null = patients) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <MessagesDialog currentUsername="dr1" patients={list ?? undefined} onClose={vi.fn()} />
    </SWRConfig>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.dispatchEvent(new Event("online"));
});

describe("MessagesDialog", () => {
  it("shows_an_empty_state_without_patients", () => {
    renderDialog([]);
    expect(screen.getByText(/no patients to message yet/i)).toBeInTheDocument();
  });

  it("does_not_claim_there_are_no_patients_when_the_list_could_not_be_loaded", () => {
    renderDialog(null);
    expect(screen.getByText(/patients are unavailable right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/no patients to message yet/i)).not.toBeInTheDocument();
  });

  it("lists_patients_to_pick_from", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /amina otieno/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /brian kamau/i })).toBeInTheDocument();
    expect(screen.getByText("Area unknown")).toBeInTheDocument();
  });

  it("loads_the_thread_for_the_selected_patient_oldest_first_and_aligns_by_sender", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse([
        makeMessage({ id: 2, sender_username: "dr1", recipient_username: "p1", body: "How are you?", timestamp: "2026-11-13T09:00:00Z" }),
        makeMessage({ id: 1, sender_username: "p1", recipient_username: "dr1", body: "Hello doctor", timestamp: "2026-11-13T08:00:00Z" }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    const items = await screen.findAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([expect.stringContaining("Hello doctor"), expect.stringContaining("How are you?")]);
    expect(items[1]).toHaveAttribute("data-mine", "true");
    expect(items[0]).toHaveAttribute("data-mine", "false");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/messages?patient=p1");
  });

  it("shows_an_empty_thread_and_a_load_error_separately", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse([])));
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    expect(await screen.findByText(/no messages yet/i)).toBeInTheDocument();
  });

  it("shows_an_error_and_not_the_empty_state_when_the_thread_fails_to_load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ detail: "boom" }, 500)));
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/no messages yet/i)).not.toBeInTheDocument();
  });

  it("cannot_send_a_blank_or_whitespace_only_message", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    await screen.findByText(/no messages yet/i);
    const send = screen.getByRole("button", { name: /send/i });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Message"), "   ");
    expect(send).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends_a_trimmed_message_to_the_selected_patient_and_appends_it", async () => {
    const sent = makeMessage({ id: 9, sender_username: "dr1", recipient_username: "p1", body: "See you Monday", timestamp: "2026-11-13T10:00:00Z" });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([]))
      .mockImplementationOnce(async () => jsonResponse(sent, 201));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    await screen.findByText(/no messages yet/i);
    await userEvent.type(screen.getByLabelText("Message"), "  See you Monday  ");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText("See you Monday")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/messages");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ body: "See you Monday", recipient_username: "p1" });
    await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""));
  });

  it("shows_the_server_error_and_keeps_the_draft_when_sending_fails", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse([]))
      .mockImplementationOnce(async () => jsonResponse({ recipient_username: ["That patient is not registered with you."] }, 400));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    await screen.findByText(/no messages yet/i);
    await userEvent.type(screen.getByLabelText("Message"), "Hi");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not registered with you/i);
    expect(screen.getByLabelText("Message")).toHaveValue("Hi");
  });

  it("goes_back_to_the_patient_list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse([])));
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    await userEvent.click(await screen.findByRole("button", { name: /back/i }));
    expect(screen.getByRole("button", { name: /brian kamau/i })).toBeInTheDocument();
  });

  it("keeps_polling_the_open_thread_while_the_browser_reports_offline", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /amina otieno/i }));
    await screen.findByText(/no messages yet/i);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_500);
    });
    // A paused poll would leave a stale thread on screen with no warning.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
