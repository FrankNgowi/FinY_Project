export type RouteDecision = "dashboard" | "unsupported" | "login";

/** The web dashboard is doctor-only; every other role gets the "use the mobile app" page. */
export function decideRoute(profile: { role: string } | null): RouteDecision {
  if (!profile) return "login";
  return typeof profile.role === "string" && profile.role.toLowerCase() === "doctor"
    ? "dashboard"
    : "unsupported";
}

/**
 * Where the home page sends a visitor whose token Django rejected. The first time it tries a
 * refresh; after a refresh already happened it gives up and signs out, so a bad token cannot loop.
 */
export function unauthorizedRedirect(alreadyRefreshed: boolean): string {
  return alreadyRefreshed ? "/api/auth/expired?final=1" : "/api/auth/expired";
}
