// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DOCTOR_HEALTH_TIPS } from "@/lib/health-tips";
import { HealthTipsDialog } from "./HealthTipsDialog";

describe("HealthTipsDialog", () => {
  it("lists_every_doctor_tip", () => {
    render(<HealthTipsDialog onClose={vi.fn()} />);
    const items = within(screen.getByRole("dialog", { name: /health tips/i })).getAllByRole("listitem");
    expect(items).toHaveLength(DOCTOR_HEALTH_TIPS.length);
    expect(DOCTOR_HEALTH_TIPS).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/acknowledge alerts as soon as/i);
  });
});
