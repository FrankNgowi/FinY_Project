export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Just now";
  const seconds = Math.floor((now.getTime() - then) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function timeOfDayGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function hasLocation(lat: number | null, lng: number | null): lat is number {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

export function mapsUrl(lat: number | null, lng: number | null): string | null {
  if (!hasLocation(lat, lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function coordinatesLabel(lat: number | null, lng: number | null): string {
  if (!hasLocation(lat, lng)) return "Location unavailable";
  return `${lat.toFixed(5)}, ${(lng as number).toFixed(5)}`;
}

export function telHref(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  // Keep "+" readable; encode everything else that is not URI-safe.
  return `tel:${encodeURIComponent(trimmed).replace(/%2B/gi, "+")}`;
}

export function formatDateTime(iso: string, locale = "en-US", timeZone?: string): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
    .format(date)
    .replace(/ /g, " ");
}

type NameParts = { username: string; first_name: string; middle_name: string; last_name: string };

export function fullName(user: NameParts): string {
  const parts = [user.first_name, user.middle_name, user.last_name].filter((p) => p && p.trim());
  return parts.length ? parts.map((p) => p.trim()).join(" ") : user.username;
}

export function initialOf(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : "?";
}
