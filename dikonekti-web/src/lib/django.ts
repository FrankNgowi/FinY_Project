import "server-only";
import { NextResponse } from "next/server";
import { ConfigError, getApiBaseUrl } from "./config";

export { ConfigError };

type Options = {
  method?: string;
  /** Sends `Authorization: Bearer <token>`. */
  token?: string;
  /** A value to send as a JSON body. */
  json?: unknown;
  /** A raw body, sent as-is (used by the proxy). Ignored when `json` is given. */
  body?: string;
  contentType?: string;
  timeoutMs?: number;
};

/**
 * The one place that knows how to call Django from the server: base URL, headers, no-store,
 * timeout. Throws ConfigError when API_BASE_URL is missing; network errors pass through.
 */
export async function djangoRequest(path: string, options: Options = {}): Promise<Response> {
  const { method = "GET", token, json, body, contentType, timeoutMs = 15_000 } = options;
  const payload = json !== undefined ? JSON.stringify(json) : body;
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (payload !== undefined) headers.set("Content-Type", contentType ?? "application/json");

  return fetch(`${getApiBaseUrl()}/${path.replace(/^\/+/, "")}`, {
    method,
    headers,
    body: payload,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Maps a failed Django call to a response. A missing or invalid API_BASE_URL is a deployment
 * mistake, so it is logged and answered with 500 instead of "server unreachable".
 */
export function upstreamFailure(tag: string, error: unknown): NextResponse {
  if (error instanceof ConfigError) {
    console.error(`[${tag}] ${error.message}`);
    return NextResponse.json({ message: "The server is not configured. Please contact support." }, { status: 500 });
  }
  return NextResponse.json({ message: "Could not reach the server. Please try again." }, { status: 502 });
}
