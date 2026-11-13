"use client";

import { useSyncExternalStore } from "react";
import { timeOfDayGreeting } from "@/lib/format";

const subscribeNever = () => () => {};
const serverGreeting = () => "Welcome";

type Props = { displayName: string; activeAlertCount: number | null };

export function WelcomeHeader({ displayName, activeAlertCount }: Props) {
  // The greeting depends on the viewer's clock. The server snapshot is neutral so hydration matches.
  const greeting = useSyncExternalStore(subscribeNever, timeOfDayGreeting, serverGreeting);

  const hasActive = activeAlertCount !== null && activeAlertCount > 0;
  const pill =
    activeAlertCount === null
      ? null
      : hasActive
        ? `${activeAlertCount} active alert${activeAlertCount === 1 ? "" : "s"}`
        : "All patients are stable";

  return (
    <header className="rounded-2xl bg-gradient-to-br from-navy to-steel p-6 text-white shadow-md">
      <p className="text-base text-white/85">{greeting},</p>
      <h1 className="text-2xl font-bold break-words sm:text-3xl">{displayName}</h1>
      {pill && (
        <span
          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${hasActive ? "bg-red-500" : "bg-white/20"}`}
        >
          {pill}
        </span>
      )}
    </header>
  );
}
