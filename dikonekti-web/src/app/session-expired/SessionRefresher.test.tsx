// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { SessionRefresher } from "./SessionRefresher";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => replace.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("SessionRefresher", () => {
  it("posts_a_refresh_once_even_under_strict_mode_and_returns_home_flagged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <StrictMode>
        <SessionRefresher final={false} />
      </StrictMode>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/?refreshed=1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("goes_to_login_when_the_refresh_is_rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ message: "expired" }, 401)));
    render(<SessionRefresher final={false} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("goes_to_login_when_the_network_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<SessionRefresher final={false} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("on_the_final_pass_signs_out_instead_of_refreshing_so_a_bad_token_cannot_loop", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionRefresher final />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/logout");
  });

  it("final_pass_still_leaves_when_the_logout_request_fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<SessionRefresher final />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("tells_the_user_what_is_happening", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<SessionRefresher final={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(/signing you in/i);
  });
});
