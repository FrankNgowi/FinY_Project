import { describe, expect, it } from "vitest";
import {
  coordinatesLabel,
  formatDateTime,
  mapsUrl,
  telHref,
  timeAgo,
  timeOfDayGreeting,
} from "./format";

const NOW = new Date("2026-11-13T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("timeAgo", () => {
  it.each([
    [0, "Just now"],
    [59, "Just now"],
    [60, "1m ago"],
    [59 * 60 + 59, "59m ago"],
    [60 * 60, "1h ago"],
    [23 * 3600 + 3599, "23h ago"],
    [24 * 3600, "1d ago"],
    [10 * 24 * 3600, "10d ago"],
  ])("%is -> %s", (seconds, expected) => {
    expect(timeAgo(ago(seconds), NOW)).toBe(expected);
  });

  it("treats_future_timestamps_from_clock_skew_as_just_now", () => {
    expect(timeAgo(ago(-300), NOW)).toBe("Just now");
  });

  it("does_not_throw_on_invalid_date", () => {
    expect(timeAgo("not-a-date", NOW)).toBe("Just now");
    expect(timeAgo("", NOW)).toBe("Just now");
  });
});

describe("timeOfDayGreeting", () => {
  const at = (h: number) => new Date(2026, 10, 13, h, 0, 0);
  it.each([
    [0, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ])("hour %i -> %s", (hour, expected) => {
    expect(timeOfDayGreeting(at(hour))).toBe(expected);
  });
});

describe("mapsUrl / coordinatesLabel", () => {
  it("builds_a_google_maps_search_url", () => {
    expect(mapsUrl(-1.2864, 36.8172)).toBe(
      "https://www.google.com/maps/search/?api=1&query=-1.2864,36.8172",
    );
  });

  it("treats_zero_zero_as_a_real_location", () => {
    expect(mapsUrl(0, 0)).toBe("https://www.google.com/maps/search/?api=1&query=0,0");
    expect(coordinatesLabel(0, 0)).toBe("0.00000, 0.00000");
  });

  it("returns_null_when_either_coordinate_is_missing", () => {
    expect(mapsUrl(null, 36.8)).toBeNull();
    expect(mapsUrl(-1.2, null)).toBeNull();
    expect(mapsUrl(null, null)).toBeNull();
    expect(coordinatesLabel(null, 36.8)).toBe("Location unavailable");
  });

  it("rounds_the_label_to_five_decimals", () => {
    expect(coordinatesLabel(-1.286389123, 36.817223987)).toBe("-1.28639, 36.81722");
  });
});

describe("telHref", () => {
  it("builds_a_tel_link", () => {
    expect(telHref("+254700123456")).toBe("tel:+254700123456");
  });

  it("trims_whitespace", () => {
    expect(telHref("  0700123456  ")).toBe("tel:0700123456");
  });

  it("returns_null_for_blank_or_missing", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref("   ")).toBeNull();
  });

  it("encodes_characters_that_could_break_out_of_the_uri", () => {
    expect(telHref("0700;ext=1 2")).toBe("tel:0700%3Bext%3D1%202");
  });
});

describe("formatDateTime", () => {
  it("formats_a_valid_iso_date", () => {
    expect(formatDateTime("2026-11-13T09:30:00Z", "en-US", "UTC")).toBe("Nov 13, 2026, 9:30 AM");
  });

  it("returns_a_placeholder_for_invalid_input", () => {
    expect(formatDateTime("nope")).toBe("Unknown time");
    expect(formatDateTime("")).toBe("Unknown time");
  });
});

import { fullName, initialOf } from "./format";

describe("fullName / initialOf", () => {
  const base = { username: "u1", first_name: "Amina", middle_name: "", last_name: "Otieno" };

  it("joins_the_name_parts", () => {
    expect(fullName({ ...base, middle_name: "Wanjiru" })).toBe("Amina Wanjiru Otieno");
  });

  it("skips_blank_and_whitespace_parts", () => {
    expect(fullName({ ...base, middle_name: "   " })).toBe("Amina Otieno");
  });

  it("falls_back_to_the_username_when_there_is_no_name", () => {
    expect(fullName({ username: "u1", first_name: "", middle_name: "", last_name: "" })).toBe("u1");
  });

  it("initialOf_uppercases_the_first_letter_or_returns_a_question_mark", () => {
    expect(initialOf("amina")).toBe("A");
    expect(initialOf("")).toBe("?");
    expect(initialOf("  ")).toBe("?");
  });
});
