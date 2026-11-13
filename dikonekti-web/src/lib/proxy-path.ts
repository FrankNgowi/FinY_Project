// Allowlist for the same-origin proxy to Django. The upstream path is built
// only from this table, never by joining client-supplied segments.

const ID = /^[0-9]{1,9}$/;

type Route = {
  method: string;
  // Each entry is either a literal segment or ID (a numeric id).
  pattern: readonly (string | typeof ID)[];
};

const ROUTES: readonly Route[] = [
  { method: "GET", pattern: ["me"] },
  { method: "GET", pattern: ["alerts"] },
  { method: "PATCH", pattern: ["alerts", ID, "acknowledge"] },
  { method: "GET", pattern: ["patients"] },
  { method: "GET", pattern: ["appointments"] },
  { method: "PATCH", pattern: ["appointments", ID, "status"] },
  { method: "GET", pattern: ["messages"] },
  { method: "POST", pattern: ["messages"] },
];

function matches(pattern: Route["pattern"], segments: readonly string[]): boolean {
  if (pattern.length !== segments.length) return false;
  return pattern.every((part, i) =>
    typeof part === "string" ? part === segments[i] : part.test(segments[i]),
  );
}

/**
 * Returns the Django path (with trailing slash) for an allowed request, or
 * null when the method/path combination is not allowed.
 */
export function resolveProxyPath(segments: readonly string[], method: string): string | null {
  const verb = method.toUpperCase();
  const route = ROUTES.find((r) => r.method === verb && matches(r.pattern, segments));
  return route ? `${segments.join("/")}/` : null;
}
