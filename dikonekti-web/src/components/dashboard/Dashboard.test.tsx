// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeAlert, makeDoctor, makeProfile } from "@/test/fixtures";
import { Dashboard } from "./Dashboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

type Routes = Record<string, () => Response | Promise<Response>>;

function mockApi(routes: Routes) {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDashboard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}>
      <Dashboard profile={makeDoctor()} />
    </SWRConfig>,
  );
}

const patients = [
  makeProfile({ username: "p1", first_name: "Amina", last_name: "Otieno" }),
  makeProfile({ username: "p2", first_name: "Brian", last_name: "Kamau" }),
  makeProfile({ username: "p3", first_name: "Cynthia", last_name: "Njeri" }),
];

afterEach(() => {
  vi.unstubAllGlobals();
  document.title = "";
});

describe("Dashboard", () => {
  it("shows_a_loading_state_before_the_first_response", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderDashboard();
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders_active_and_resolved_alerts_patients_counts_and_the_tab_title", async () => {
    mockApi({
      "GET /api/alerts": () =>
        jsonResponse([
          makeAlert({ id: 1, patient_name: "Amina Otieno" }),
          makeAlert({ id: 2, patient_name: "Brian Kamau" }),
          makeAlert({ id: 3, patient_name: "Cynthia Njeri", acknowledged: true }),
        ]),
      "GET /api/patients": () => jsonResponse(patients),
    });
    renderDashboard();
    expect(await screen.findByText("2 active alerts")).toBeInTheDocument();
    const alertsSection = screen.getByRole("region", { name: /emergency alerts/i });
    expect(within(alertsSection).getByText("2 active")).toBeInTheDocument();
    expect(within(alertsSection).getByRole("heading", { name: /resolved/i })).toBeInTheDocument();
    expect(within(alertsSection).getAllByRole("button", { name: /acknowledge alert/i })).toHaveLength(2);
    const patientsSection = screen.getByRole("region", { name: /my patients/i });
    expect(within(patientsSection).getByLabelText(/3 patients/i)).toBeInTheDocument();
    expect(within(patientsSection).getByText("Brian Kamau")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("(2) Dikonekti"));
  });

  it("uses_the_singular_for_one_active_alert", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([makeAlert()]),
      "GET /api/patients": () => jsonResponse(patients),
    });
    renderDashboard();
    expect(await screen.findByText("1 active alert")).toBeInTheDocument();
  });

  it("shows_the_empty_states", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([]),
      "GET /api/patients": () => jsonResponse([]),
    });
    renderDashboard();
    expect(await screen.findByText(/no emergency alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/no patients have registered with you yet/i)).toBeInTheDocument();
    expect(screen.getByText("All patients are stable")).toBeInTheDocument();
  });

  it("shows_a_banner_and_does_not_claim_empty_when_loading_fails", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse({ detail: "boom" }, 500),
      "GET /api/patients": () => jsonResponse({ detail: "boom" }, 500),
    });
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/no emergency alerts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no patients have registered/i)).not.toBeInTheDocument();
  });

  it("keeps_showing_alerts_when_only_patients_fail", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([makeAlert({ patient_name: "Amina Otieno" })]),
      "GET /api/patients": () => jsonResponse({ detail: "boom" }, 500),
    });
    renderDashboard();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Amina Otieno" })).toBeInTheDocument();
  });

  it("moves_an_acknowledged_alert_to_resolved", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([makeAlert({ id: 7, patient_name: "Amina Otieno" })]),
      "GET /api/patients": () => jsonResponse(patients),
      "PATCH /api/alerts/7/acknowledge": () => jsonResponse(makeAlert({ id: 7, patient_name: "Amina Otieno", acknowledged: true })),
    });
    renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: /acknowledge alert from amina otieno/i }));
    expect(await screen.findByText(/marked resolved/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /acknowledge alert/i })).not.toBeInTheDocument();
    expect(screen.getByText("All patients are stable")).toBeInTheDocument();
  });

  it("keeps_the_alert_active_and_shows_an_error_when_acknowledge_fails", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([makeAlert({ id: 7 })]),
      "GET /api/patients": () => jsonResponse(patients),
      "PATCH /api/alerts/7/acknowledge": () => jsonResponse({ detail: "You do not have permission." }, 403),
    });
    renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: /acknowledge alert/i }));
    expect(await screen.findByText(/could not acknowledge/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /acknowledge alert/i })).toBeEnabled();
  });

  it("offers_the_four_quick_actions_and_a_logout", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([]),
      "GET /api/patients": () => jsonResponse([]),
    });
    renderDashboard();
    await screen.findByText(/no emergency alerts/i);
    const actions = screen.getByRole("region", { name: /quick actions/i });
    for (const name of ["Profile", "Health Tips", "Schedule", "Messages"]) {
      expect(within(actions).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});

describe("Dashboard quick action dialogs", () => {
  async function openAction(name: string) {
    mockApi({
      "GET /api/alerts": () => jsonResponse([]),
      "GET /api/patients": () => jsonResponse(patients),
      "GET /api/appointments": () => jsonResponse([]),
    });
    renderDashboard();
    await screen.findByText(/no emergency alerts/i);
    await userEvent.click(within(screen.getByRole("region", { name: /quick actions/i })).getByRole("button", { name }));
  }

  it("opens_profile_and_closes_it", async () => {
    await openAction("Profile");
    const dialog = screen.getByRole("dialog", { name: /profile/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens_health_tips", async () => {
    await openAction("Health Tips");
    expect(screen.getByRole("dialog", { name: /health tips/i })).toBeInTheDocument();
  });

  it("opens_schedule_and_loads_appointments_only_then", async () => {
    await openAction("Schedule");
    expect(screen.getByRole("dialog", { name: /schedule/i })).toBeInTheDocument();
    expect(await screen.findByText(/no appointment requests/i)).toBeInTheDocument();
  });

  it("opens_messages_with_the_patients_already_loaded", async () => {
    await openAction("Messages");
    const dialog = screen.getByRole("dialog", { name: /messages/i });
    expect(within(dialog).getByRole("button", { name: /amina otieno/i })).toBeInTheDocument();
  });

  it("messages_does_not_claim_no_patients_when_the_patient_list_failed_to_load", async () => {
    mockApi({
      "GET /api/alerts": () => jsonResponse([]),
      "GET /api/patients": () => jsonResponse({ detail: "boom" }, 500),
    });
    renderDashboard();
    await screen.findByText(/no emergency alerts/i);
    await userEvent.click(within(screen.getByRole("region", { name: /quick actions/i })).getByRole("button", { name: "Messages" }));
    const dialog = screen.getByRole("dialog", { name: /messages/i });
    expect(within(dialog).getByText(/patients are unavailable/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/no patients to message yet/i)).not.toBeInTheDocument();
  });
});
