import Link from "next/link";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { BrandMark } from "./BrandMark";

type Props = {
  asHeading?: boolean;
  /** Makes the mark and name a link to this address (used once signed in). */
  homeHref?: string;
};

/** Mark, name and tagline, laid out like the mobile login screen. */
export function BrandHeader({ asHeading = false, homeHref }: Props) {
  const nameClass = "mt-3.5 text-[26px] leading-tight font-bold text-brand-ink";
  const name = asHeading ? <h1 className={nameClass}>{BRAND_NAME}</h1> : <p className={nameClass}>{BRAND_NAME}</p>;
  const logo = (
    <>
      <BrandMark />
      {name}
    </>
  );
  return (
    <div className="flex flex-col items-center text-center">
      {homeHref ? (
        <Link
          href={homeHref}
          aria-label={`${BRAND_NAME} home`}
          className="flex flex-col items-center rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          {logo}
        </Link>
      ) : (
        logo
      )}
      <p className="mt-1 text-sm text-muted">{BRAND_TAGLINE}</p>
    </div>
  );
}
