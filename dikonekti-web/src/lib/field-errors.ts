/** Flattens a DRF validation error body into `{ field: [messages] }`. Form-wide errors go under `form`. */
export function extractFieldErrors(body: unknown): Record<string, string[]> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const messages = (typeof value === "string" ? [value] : Array.isArray(value) ? value : []).filter(
      (m): m is string => typeof m === "string" && m.trim() !== "",
    );
    if (messages.length === 0) continue;
    const field = key === "non_field_errors" || key === "detail" ? "form" : key;
    result[field] = [...(result[field] ?? []), ...messages];
  }
  return result;
}
