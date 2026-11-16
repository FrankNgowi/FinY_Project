// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandHeader } from "./BrandHeader";

describe("BrandHeader", () => {
  it("shows_the_name_and_tagline_and_hides_the_decorative_mark_from_screen_readers", () => {
    const { container } = render(<BrandHeader />);
    expect(screen.getByText("Dikonekti")).toBeInTheDocument();
    expect(screen.getByText("Care, connected.")).toBeInTheDocument();
    const mark = container.querySelector("svg");
    expect(mark).toBeInTheDocument();
    expect(mark?.closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("is_a_plain_label_by_default_so_the_page_can_own_its_h1", () => {
    render(<BrandHeader />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("can_render_the_name_as_the_page_h1", () => {
    render(<BrandHeader asHeading />);
    expect(screen.getByRole("heading", { level: 1, name: "Dikonekti" })).toBeInTheDocument();
  });

  it("is_not_a_link_by_default", () => {
    render(<BrandHeader />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links_the_mark_and_name_to_the_given_home_address_with_a_clear_label", () => {
    render(<BrandHeader homeHref="/" />);
    const link = screen.getByRole("link", { name: "Dikonekti home" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveTextContent("Dikonekti");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("keeps_the_tagline_outside_the_link", () => {
    render(<BrandHeader homeHref="/" />);
    expect(screen.getByRole("link", { name: "Dikonekti home" })).not.toHaveTextContent("Care, connected.");
    expect(screen.getByText("Care, connected.")).toBeInTheDocument();
  });

  it("still_hides_the_decorative_mark_from_screen_readers_inside_the_link", () => {
    const { container } = render(<BrandHeader homeHref="/" />);
    expect(container.querySelector("svg")?.closest("[aria-hidden=true]")).not.toBeNull();
  });
});
