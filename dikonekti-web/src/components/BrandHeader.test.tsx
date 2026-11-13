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
});
