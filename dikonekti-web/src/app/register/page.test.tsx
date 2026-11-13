// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import RegisterPage from "./page";

describe("RegisterPage", () => {
  it("states_that_it_is_for_doctors_only", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByText(/doctor accounts only/i)).toBeInTheDocument();
  });

  it("shows_the_brand_while_keeping_create_account_as_the_h1", () => {
    const { container } = render(<RegisterPage />);
    expect(screen.getByText("Dikonekti")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Create account" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
