import { NextResponse, type NextRequest } from "next/server";
import { djangoRequest, upstreamFailure } from "@/lib/django";
import { resolveProxyPath } from "@/lib/proxy-path";
import { BodyTooLargeError, MAX_PROXY_BODY_BYTES, readBodyCapped } from "@/lib/read-body";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  applySessionCookies,
  clearSessionCookies,
  refreshTokens,
  type Tokens,
} from "@/lib/session";

type Context = { params: Promise<{ path: string[] }> };

const GENERIC_ERROR = "Something went wrong. Please try again.";

function message(text: string, status: number) {
  return NextResponse.json({ message: text }, { status });
}

function sessionExpired() {
  const response = message("Your session has expired. Please log in again.", 401);
  clearSessionCookies(response);
  return response;
}

async function handle(request: NextRequest, { params }: Context) {
  const { path } = await params;
  const upstreamPath = resolveProxyPath(path, request.method);
  if (!upstreamPath) return message("Not found.", 404);

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!access && !refresh) return sessionExpired();

  // Only the messages thread takes a query parameter; drop everything else.
  const patient = upstreamPath === "messages/" ? request.nextUrl.searchParams.get("patient") : null;
  const target = `${upstreamPath}${patient ? `?patient=${encodeURIComponent(patient)}` : ""}`;
  // Bytes, never text: a text read would corrupt a binary upload. The body is read once, so the
  // retry after a token refresh below can send exactly the same bytes again.
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.method !== "GET") {
    try {
      body = await readBodyCapped(request, MAX_PROXY_BODY_BYTES);
    } catch (error) {
      if (error instanceof BodyTooLargeError) return message("The request is too large.", 413);
      throw error;
    }
  }
  const contentType = request.headers.get("content-type") ?? "application/json";

  const send = (token: string) => djangoRequest(target, { method: request.method, token, body, contentType });

  let refreshed: Tokens | null = null;
  if (!access) {
    refreshed = await refreshTokens(refresh!);
    if (!refreshed) return sessionExpired();
    access = refreshed.access;
  }

  let upstream: Response;
  try {
    upstream = await send(access);
    if (upstream.status === 401) {
      // One refresh attempt per request, and never after we already refreshed.
      if (refreshed || !refresh) return sessionExpired();
      refreshed = await refreshTokens(refresh);
      if (!refreshed) return sessionExpired();
      upstream = await send(refreshed.access);
      if (upstream.status === 401) return sessionExpired();
    }
  } catch (error) {
    return upstreamFailure("api/proxy", error);
  }

  const response = await toResponse(upstream);
  if (refreshed) applySessionCookies(response, refreshed);
  return response;
}

async function toResponse(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  const isJson = upstream.headers.get("content-type")?.includes("application/json");
  if (!isJson) {
    // Never relay HTML error pages or stack traces to the browser.
    return message(GENERIC_ERROR, upstream.ok ? 502 : upstream.status);
  }
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
