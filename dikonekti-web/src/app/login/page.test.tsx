// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("offers_a_create_account_link", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /create account/i })).toHaveAttribute("href", "/register");
  });

  it("shows_the_brand_mark_name_and_tagline", () => {
    const { container } = render(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Dikonekti" })).toBeInTheDocument();
    expect(screen.getByText("Care, connected.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
