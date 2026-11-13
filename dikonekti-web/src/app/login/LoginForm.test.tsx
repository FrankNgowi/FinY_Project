// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { LoginForm } from "./LoginForm";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function fill(user: ReturnType<typeof userEvent.setup>, username = "dr1", password = "secret") {
  if (username) await user.type(screen.getByLabelText(/username/i), username);
  if (password) await user.type(screen.getByLabelText(/password/i), password);
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("LoginForm", () => {
  it("posts_the_credentials_and_goes_to_the_dashboard_on_success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ role: "doctor", display_name: "Dr. Jane" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    // One navigation, one server render: an extra refresh would re-fetch /me for nothing.
    expect(refresh).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse(init.body)).toEqual({ username: "dr1", password: "secret" });
  });

  it("shows_the_server_error_in_an_alert_and_stays_on_the_page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ message: "No active account found with the given credentials" }, 401)));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No active account found with the given credentials");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /log in/i })).toBeEnabled();
  });

  it("shows_a_friendly_message_when_the_network_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/i);
  });

  it("falls_back_to_a_generic_message_for_a_non_json_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("disables_the_button_while_loading_and_blocks_double_submit", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm />);
    await fill(user);
    const button = screen.getByRole("button", { name: /log in/i });
    await user.click(button);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(reply({ role: "doctor", display_name: "Dr" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it("does_not_call_the_server_for_blank_fields", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/username/i), "   ");
    await user.type(screen.getByLabelText(/password/i), "x");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your username and password/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("masks_the_password_field", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "password");
  });
});
