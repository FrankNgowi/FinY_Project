import "server-only";

/** Thrown when the server is misconfigured (for example API_BASE_URL is missing). */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Base URL of the Django API, e.g. http://localhost:8000/api (no trailing slash). */
export function getApiBaseUrl(): string {
  const raw = (process.env.API_BASE_URL ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(raw)) {
    throw new ConfigError("API_BASE_URL must be set to an http(s) URL, e.g. http://localhost:8000/api");
  }
  return raw.replace(/\/+$/, "");
}
