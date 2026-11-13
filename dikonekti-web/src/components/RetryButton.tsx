"use client";

import { useRouter } from "next/navigation";

export function RetryButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="rounded-xl bg-navy px-4 py-2.5 font-semibold text-white hover:bg-steel"
    >
      Try again
    </button>
  );
}
