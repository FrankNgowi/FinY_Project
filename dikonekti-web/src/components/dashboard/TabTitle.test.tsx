// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TabTitle } from "./TabTitle";

beforeEach(() => {
  document.title = "Dikonekti";
});

describe("TabTitle", () => {
  it("prefixes_the_active_alert_count", () => {
    render(<TabTitle activeAlertCount={2} />);
    expect(document.title).toBe("(2) Dikonekti");
  });

  it("shows_the_plain_title_for_zero_or_unknown", () => {
    const { rerender } = render(<TabTitle activeAlertCount={0} />);
    expect(document.title).toBe("Dikonekti");
    rerender(<TabTitle activeAlertCount={null} />);
    expect(document.title).toBe("Dikonekti");
  });

  it("updates_when_the_count_changes_and_restores_on_unmount", () => {
    const { rerender, unmount } = render(<TabTitle activeAlertCount={1} />);
    expect(document.title).toBe("(1) Dikonekti");
    rerender(<TabTitle activeAlertCount={3} />);
    expect(document.title).toBe("(3) Dikonekti");
    unmount();
    expect(document.title).toBe("Dikonekti");
  });
});
