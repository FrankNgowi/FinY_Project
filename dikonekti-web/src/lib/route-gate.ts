export type RouteDecision = "dashboard" | "verification" | "unsupported" | "login";

/**
 * The web dashboard is doctor-only, and only for an approved doctor. A doctor in any other state
 * (including a status this app does not know) goes to the verification screen: failing closed
 * means a surprise value never shows the dashboard. Every other role gets the "use the mobile app"
 * page. Django enforces the same rule on every endpoint; this only chooses the screen.
 */
export function decideRoute(profile: { role: string; verification_status?: unknown } | null): RouteDecision {
  if (!profile) return "login";
  const isDoctor = typeof profile.role === "string" && profile.role.toLowerCase() === "doctor";
  if (!isDoctor) return "unsupported";
  return profile.verification_status === "approved" ? "dashboard" : "verification";
}

/**
 * Where the home page sends a visitor whose token Django rejected. The first time it tries a
 * refresh; after a refresh already happened it gives up and signs out, so a bad token cannot loop.
 * Both steps run as POSTs from the /session-expired page, never as GET side effects.
 */
export function unauthorizedRedirect(alreadyRefreshed: boolean): string {
  return alreadyRefreshed ? "/session-expired?final=1" : "/session-expired";
}
