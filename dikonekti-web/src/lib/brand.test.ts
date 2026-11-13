import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_GLYPH_PATH } from "./brand";

const appDir = path.resolve(__dirname, "../app");

describe("brand icon file", () => {
  it("icon_svg_uses_the_same_glyph_and_the_app_gradient", () => {
    const svg = readFileSync(path.join(appDir, "icon.svg"), "utf8");
    expect(svg).toContain(BRAND_GLYPH_PATH);
    expect(svg.toLowerCase()).toContain("#6750a4");
    expect(svg.toLowerCase()).toContain("#9b7fe8");
  });

  it("the_scaffold_favicon_is_gone_so_the_brand_icon_is_the_tab_icon", () => {
    expect(existsSync(path.join(appDir, "favicon.ico"))).toBe(false);
  });
});
