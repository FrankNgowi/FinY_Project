# dikonekti-web

Doctor dashboard for Dikonekti, built with Next.js (App Router, TypeScript, Tailwind). It talks to the existing Django REST API in `Dikonekt_Backend/`. Only approved doctors can use the dashboard; a doctor who is not approved yet uploads a confirmation letter or certificate on `/verification`. Other roles see a "use the mobile app" page.

## How it works

- The browser only calls same-origin `/api/*` routes. Those routes proxy to Django with the user's token.
- Login runs in `src/app/api/auth/login/route.ts`. The JWTs are stored in `httpOnly` cookies (`dik_access`, `dik_refresh`) and are never sent to page JavaScript.
- `src/proxy.ts` (Next 16's replacement for `middleware.ts`) redirects anonymous visitors and refreshes an expired access token.
- `src/lib/proxy-path.ts` is the allowlist of Django endpoints the proxy will forward.
- `src/lib/django.ts` is the only server-side code that calls Django. `src/lib/api-client.ts` is the only browser-side caller of the web app's own `/api/*` routes.
- Doctor verification: `src/lib/route-gate.ts` sends a doctor whose `verification_status` (from `GET /api/me/`) is anything but `approved` to `/verification`, and an approved doctor who opens `/verification` back to `/`. The panel polls `me/verification` every 30 seconds only while the document is pending. If any request answers `403` with `verification_required` (approval withdrawn while the dashboard was open), `apiFetch` sends the doctor to `/verification`.
- Uploads: the browser sends `FormData` (no forced content type). The proxy reads request bodies as bytes with `src/lib/read-body.ts` and refuses more than 6 MB with `413`, before Django is called; Django enforces the real 5 MB limit and checks the file type. Next's own body limit does not apply to `/api` routes, so this cap is the only one.
- Deploy the Django backend with doctor verification before this web app: a doctor profile without `verification_status` is treated as not approved.
- `src/lib/schemas/auth.ts` holds the login and registration rules; the forms (React Hook Form) and the API routes both use it.

## Setup

```bash
cp .env.example .env.local   # set API_BASE_URL (server-side only)
npm install
npm run dev                  # http://localhost:3000
```

Run Django in another terminal. It needs a few environment variables first; see `Dikonekt_Backend/dikonekti/README.md`. `API_BASE_URL` must include the `/api` prefix, e.g. `http://localhost:8000/api`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit and component tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build (needs `API_BASE_URL` at runtime, not at build time) |

## Keep in step with the mobile app

- `src/lib/health-tips.ts` is a copy of the doctor tips in the Flutter app (`_healthTipsFor` in `dikonekti/lib/screens/dashboard_components.dart`).
- `src/lib/types.ts` mirrors the Django serializers. Change both together.
- `src/lib/options.ts` is a copy of the area and specialization lists in `dikonekti/lib/screens/create_account_page.dart`.
