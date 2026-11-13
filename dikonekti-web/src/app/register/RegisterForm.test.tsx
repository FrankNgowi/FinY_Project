// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { AREAS, SPECIALIZATIONS } from "@/lib/options";
import { RegisterForm } from "./RegisterForm";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function fillValid(user: ReturnType<typeof userEvent.setup>, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    "First name": "Neema",
    "Last name": "Kariuki",
    Username: "dr_new",
    Email: "neema@example.test",
    "Phone number": "+254700123123",
    Password: "Str0ng#Pass2026",
    "Confirm password": "Str0ng#Pass2026",
    ...overrides,
  };
  const { Area: area = "Stone Town", Specialization: specialization = "Vision", ...typed } = values;
  for (const [label, value] of Object.entries(typed)) {
    if (value) await user.type(screen.getByLabelText(label, { exact: true }), value);
  }
  await user.selectOptions(screen.getByLabelText("Area"), area);
  await user.selectOptions(screen.getByLabelText("Specialization"), specialization);
}

beforeEach(() => replace.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("RegisterForm", () => {
  it("posts_the_details_and_goes_to_the_dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ role: "doctor", display_name: "Dr. Neema Kariuki" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/register");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ username: "dr_new", first_name: "Neema", area: "Stone Town", specialization: "Vision", password: "Str0ng#Pass2026" });
    expect(sent).not.toHaveProperty("confirm_password");
    expect(sent).not.toHaveProperty("role");
  });

  it("masks_both_password_fields", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password");
  });

  it("blocks_submit_and_marks_each_required_field_when_empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RegisterForm />);
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    for (const label of ["First name", "Last name", "Username", "Phone number", "Area", "Specialization", "Password"]) {
      expect(screen.getByLabelText(label, { exact: true })).toBeInvalid();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses_natural_wording_for_the_required_messages", async () => {
    render(<RegisterForm />);
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByText("Confirm your password.")).toBeInTheDocument();
    expect(screen.queryByText(/enter your confirm/i)).not.toBeInTheDocument();
  });

  it("blocks_submit_when_the_passwords_differ", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user, { "Confirm password": "different" });
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByLabelText("Confirm password")).toBeInvalid();
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows_django_field_errors_next_to_the_fields_and_keeps_the_input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({ message: "Please fix the highlighted fields.", errors: { username: ["A user with that username already exists."], password: ["This password is too common."] } }, 400),
      ),
    );
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("A user with that username already exists.")).toBeInTheDocument();
    expect(screen.getByText("This password is too common.")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInvalid();
    expect(screen.getByLabelText("Username")).toHaveValue("dr_new");
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows_a_form_level_alert_for_server_and_network_failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
  });

  it("disables_the_button_while_sending_and_blocks_double_submit", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(reply({ role: "doctor", display_name: "Dr" }, 201));
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it("links_back_to_login", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });

  it("area_and_specialization_are_dropdowns_with_the_mobile_options", () => {
    render(<RegisterForm />);
    const area = screen.getByRole("combobox", { name: "Area" });
    const specialization = screen.getByRole("combobox", { name: "Specialization" });
    const texts = (el: HTMLElement) => Array.from(el.querySelectorAll("option")).map((o) => o.textContent);
    expect(texts(area)).toEqual(["Select an area", ...AREAS]);
    expect(texts(specialization)).toEqual(["Select a specialization", ...SPECIALIZATIONS]);
  });

  it("blocks_submit_until_an_area_and_specialization_are_chosen", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RegisterForm />);
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByLabelText("Area")).toBeInvalid();
    expect(screen.getByLabelText("Specialization")).toBeInvalid();
    expect(screen.getByText("Select your area.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("others_reveals_a_required_box_and_sends_its_text_as_the_specialization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ role: "doctor", display_name: "Dr" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegisterForm />);
    expect(screen.queryByLabelText("Specify specialization")).not.toBeInTheDocument();
    await fillValid(user, { Specialization: "Others" });
    const other = screen.getByLabelText("Specify specialization");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(other).toBeInvalid();
    // The error belongs to the box only, not to the dropdown that already has a value.
    expect(screen.getAllByText("Enter your specialization.")).toHaveLength(1);
    expect(screen.getByLabelText("Specialization")).not.toBeInvalid();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(other, "Autism care");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.specialization).toBe("Autism care");
    expect(sent).not.toHaveProperty("specialization_other");
  });

  it("hides_the_other_box_again_when_a_listed_specialization_is_picked", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.selectOptions(screen.getByLabelText("Specialization"), "Others");
    expect(screen.getByLabelText("Specify specialization")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Specialization"), "Hearing");
    expect(screen.queryByLabelText("Specify specialization")).not.toBeInTheDocument();
  });
});
