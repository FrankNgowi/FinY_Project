// Browser-side fetch wrapper. Only ever talks to same-origin /api/* routes,
// which attach the auth cookie's token and proxy to Django.

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_MESSAGE = "Could not reach the server. Check your connection and try again.";

export class ApiError extends Error {
  readonly status: number;
  /** The parsed JSON error body, when there was one (for example `{ errors: { field: [...] } }`). */
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Pulls a human-readable message out of DRF's various error shapes. */
export function extractErrorMessage(body: unknown): string {
  return findMessage(body) ?? FALLBACK_MESSAGE;
}

function findMessage(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMessage(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["detail", "message", "non_field_errors"]) {
      const found = findMessage(record[key]);
      if (found) return found;
    }
    for (const nested of Object.values(record)) {
      const found = findMessage(nested);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Same-origin proxy URL for a Django path. Next.js redirects `/api/x/` to `/api/x`,
 * so the trailing slash is dropped here to avoid a second request per call.
 */
export function proxyUrl(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  const at = trimmed.indexOf("?");
  const pathname = at === -1 ? trimmed : trimmed.slice(0, at);
  const query = at === -1 ? "" : trimmed.slice(at); // everything from the first "?", untouched
  return `/api/${pathname.replace(/\/+$/, "")}${query}`;
}

type Options = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Send the browser to /login on a 401. Turn off for login and logout themselves. Default true. */
  redirectOnUnauthorized?: boolean;
};

export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, signal, redirectOnUnauthorized = true } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(proxyUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, NETWORK_MESSAGE);
  }

  if (response.status === 401 && redirectOnUnauthorized) {
    window.location.replace("/login");
    throw new ApiError(401, "Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const parsed = await response.json().catch(() => undefined);
    throw new ApiError(response.status, extractErrorMessage(parsed), parsed);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Typed fetcher for SWR: `useSWR(key, swrFetcher<Alert[]>)`. */
export function swrFetcher<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}
