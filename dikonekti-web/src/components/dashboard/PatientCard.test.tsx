// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeProfile } from "@/test/fixtures";
import { PatientCard } from "./PatientCard";

describe("PatientCard", () => {
  it("shows_name_type_area_initial_and_a_call_link", () => {
    render(<PatientCard patient={makeProfile()} />);
    expect(screen.getByText("Amina Otieno")).toBeInTheDocument();
    expect(screen.getByText("Vision · Kibera")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call amina otieno/i })).toHaveAttribute("href", "tel:+254700111222");
  });

  it("uses_placeholders_for_missing_optional_data_and_hides_call_without_a_phone", () => {
    render(<PatientCard patient={makeProfile({ phone_number: null, disability_type: null, area: null })} />);
    expect(screen.getByText("Not specified · Area unknown")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /call/i })).not.toBeInTheDocument();
  });

  it("falls_back_to_the_username_when_the_name_is_empty", () => {
    render(<PatientCard patient={makeProfile({ first_name: "", last_name: "", middle_name: "" })} />);
    expect(screen.getByText("patient1")).toBeInTheDocument();
  });
});
