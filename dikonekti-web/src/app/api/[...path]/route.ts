import { NextResponse, type NextRequest } from "next/server";
import { djangoRequest, upstreamFailure } from "@/lib/django";
import { allowedQuery, isDocumentPath, resolveProxyPath } from "@/lib/proxy-path";
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

  // Only the query parameters listed for this endpoint are forwarded; everything else is dropped.
  const query = allowedQuery(upstreamPath)
    .map((name) => [name, request.nextUrl.searchParams.get(name)] as const)
    .filter((pair): pair is readonly [string, string] => !!pair[1])
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");
  const target = query ? `${upstreamPath}?${query}` : upstreamPath;
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

  const response = await toResponse(upstream, isDocumentPath(upstreamPath));
  if (refreshed) applySessionCookies(response, refreshed);
  return response;
}

// What an admin may be shown from the certificate route, and nothing else: relaying any other type
// (HTML, SVG, script) from the web app's own address would let a file run as part of the app.
const FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * The proxy sets the isolation headers itself instead of trusting the upstream reply to send them:
 * a certificate is user-uploaded content served from the web app's own address. The file name is
 * fixed too, so nothing the doctor chose can reach a header. Only the length is taken from Django.
 */
function fileResponse(upstream: Response): NextResponse | null {
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!upstream.ok || !FILE_TYPES.has(type) || !upstream.body) return null;
  const headers = new Headers({
    "Content-Type": type,
    "Content-Disposition": 'inline; filename="certificate"',
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
    "Cache-Control": "private, no-store",
  });
  const length = upstream.headers.get("content-length");
  if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);
  return new NextResponse(upstream.body, { status: 200, headers });
}

async function toResponse(upstream: Response, document = false): Promise<NextResponse> {
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  if (document) {
    const file = fileResponse(upstream);
    if (file) return file;
  }
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
