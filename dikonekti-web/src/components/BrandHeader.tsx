import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { BrandMark } from "./BrandMark";

/** Mark, name and tagline, laid out like the mobile login screen. */
export function BrandHeader({ asHeading = false }: { asHeading?: boolean }) {
  const nameClass = "mt-3.5 text-[26px] leading-tight font-bold text-brand-ink";
  return (
    <div className="flex flex-col items-center text-center">
      <BrandMark />
      {asHeading ? <h1 className={nameClass}>{BRAND_NAME}</h1> : <p className={nameClass}>{BRAND_NAME}</p>}
      <p className="mt-1 text-sm text-muted">{BRAND_TAGLINE}</p>
    </div>
  );
}
