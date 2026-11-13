"use client";

import { useEffect, useState } from "react";
import { coordinatesLabel, mapsUrl } from "@/lib/format";
import type { EmergencyAlert } from "@/lib/types";

type CopyState = "idle" | "copied" | "failed";

const COPY_STATUS_MS = 2_000;

export function AlertLocation({ alert }: { alert: EmergencyAlert }) {
  const [copy, setCopy] = useState<CopyState>("idle");

  // Clear the "Copied" / "Could not copy" status after a moment so it never goes stale.
  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), COPY_STATUS_MS);
    return () => clearTimeout(timer);
  }, [copy]);
  const url = mapsUrl(alert.latitude, alert.longitude);

  if (!url) {
    return (
      <div className="rounded-xl bg-page px-3 py-2 text-sm">
        <p className="font-medium text-ink">Location unavailable</p>
        {alert.location_error && <p className="mt-0.5 text-muted">{alert.location_error}</p>}
      </div>
    );
  }

  const label = coordinatesLabel(alert.latitude, alert.longitude);

  async function copyCoordinates() {
    try {
      await navigator.clipboard.writeText(label);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-page px-3 py-2 text-sm">
      <span className="font-mono text-ink">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-steel underline underline-offset-2"
      >
        Open in Google Maps
      </a>
      <button type="button" onClick={copyCoordinates} className="font-medium text-steel underline underline-offset-2">
        Copy coordinates
      </button>
      <span role="status" className="text-muted">
        {copy === "copied" ? "Copied" : copy === "failed" ? "Could not copy" : ""}
      </span>
    </div>
  );
}
