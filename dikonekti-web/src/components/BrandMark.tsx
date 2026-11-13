import { BRAND_GLYPH_PATH } from "@/lib/brand";

/** The Dikonekti mark: white hand-and-heart glyph on a purple gradient circle (decorative). */
export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(to bottom right, var(--brand), var(--brand-light))",
        boxShadow: "0 8px 18px rgb(103 80 164 / 0.3)",
      }}
    >
      <svg viewBox="0 0 24 24" width={(size * 34) / 72} height={(size * 34) / 72} fill="currentColor">
        <path d={BRAND_GLYPH_PATH} />
      </svg>
    </span>
  );
}
