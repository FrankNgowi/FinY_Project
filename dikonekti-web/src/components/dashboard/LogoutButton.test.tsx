// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { LogoutButton } from "./LogoutButton";

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("LogoutButton", () => {
  it("posts_to_logout_and_goes_to_login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/logout");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("still_leaves_when_the_request_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("ignores_a_second_click_while_logging_out", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);
    render(<LogoutButton />);
    const button = screen.getByRole("button", { name: /log out/i });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(null, { status: 204 }));
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  });
});
