import "server-only";
import { cookies } from "next/headers";
import { djangoRequest } from "./django";
import { ACCESS_COOKIE } from "./session";
import type { UserProfile } from "./types";

export type ProfileResult =
  | { status: "ok"; profile: UserProfile }
  | { status: "unauthorized" }
  | { status: "error" };

/** Fetches the logged-in user's profile on the server using the access cookie. */
export async function getServerProfile(): Promise<ProfileResult> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return { status: "unauthorized" };
  try {
    const response = await djangoRequest("me/", { token: access, timeoutMs: 10_000 });
    if (response.status === 401) return { status: "unauthorized" };
    if (!response.ok) return { status: "error" };
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "error" };
    return { status: "ok", profile: data as UserProfile };
  } catch {
    return { status: "error" };
  }
}
