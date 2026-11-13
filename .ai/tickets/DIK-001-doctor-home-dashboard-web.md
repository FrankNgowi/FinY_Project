# DIK-001: Doctor home dashboard on web (Next.js)

**Type:** Feature
**Priority:** Medium
**Platform:** New Next.js web app (`dikonekti-web/`). Mobile Flutter app and Django backend unchanged.
**Depends on:** None

---

## Problem Statement

Doctors can only monitor emergency alerts and patients through the Flutter mobile app. Doctors often work at a desk and need a larger view of incoming alerts, their patient list and the map links. There is no web frontend. This ticket creates a Next.js web app whose first screen is the Doctor home dashboard, mirroring the content of the mobile `DoctorDashboard` with a desktop layout. It talks to the existing Django REST API.

---

## User Stories

- As a **Doctor**, I want to log in on the web and see active and resolved emergency alerts at a glance, so that I can respond quickly from my desk.
- As a **Doctor**, I want to see my patients and open Schedule and Messages without leaving the page, so that I can work efficiently on a large screen.
- As a **Disabled User**, I want a clear message if I log in on the web app, so that I know to use the mobile app, where SOS, GPS and voice trigger work.

---

## Approved Design / Behaviour

Same content as the mobile Doctor dashboard (`DoctorDashboard` in `dashboard_components.dart`), in a responsive layout. Wide screens (>= 1024px) use two columns. Narrower screens stack into one column.

```
+ Header: Dikonekti - Doctor Dashboard                          [Logout] +
| Welcome header (greeting, name, N active alerts)                       |
+-------------------------------+----------------------------------------+
| Emergency Alerts [N active]   | My Patients [count]                    |
|  active alert cards           |  patient cards (call, area)            |
|  Resolved list                | Quick Actions                          |
|                               |  Profile, Health Tips, Schedule,       |
|                               |  Messages                              |
+-------------------------------+----------------------------------------+
```

- **Routes:** `/login`, `/` (dashboard, requires auth). Unauthenticated users are redirected to `/login`.
- **Alerts:** active (unacknowledged) cards first, then Resolved. Each card shows patient name, area, disability type, phone (call link), time ago, and location: coordinates, "Open in Google Maps" link and copy button, or "Location unavailable" plus the location error. Active cards have an Acknowledge button.
- **Patients:** card per patient (name, area, call link). Empty state: "No patients have registered with you yet."
- **Refresh:** alerts and patients refetch every 12s while the tab is visible and on manual refresh. A load failure shows a non-blocking error banner and keeps the last data.
- **Quick actions:** Profile and Health Tips open as dialogs. Schedule (view and accept or decline appointment requests) and Messages (pick a patient, view the thread, send a message) open as dialogs or a side panel. Behaviour matches the mobile sheets.
- **Tab title:** shows the active alert count, e.g. `(2) Dikonekti`.
- **Disabled User on web:** after a successful login the app shows a full-page message: "The web dashboard is for doctors. Please use the Dikonekti mobile app." plus a logout button. Tokens are set for any valid login so logout works; the dashboard route and its data requests are gated on the profile `role`, and only `GET me/` is requested for a Disabled User.
- **Branding:** `/login` and `/register` show the same mark as the mobile login screen (white Material `volunteer_activism` icon on a purple gradient circle), the name "Dikonekti" and the tagline "Care, connected.". The same mark is the browser-tab icon. The Flutter launcher icons are still the default Flutter logo, so there is no separate app-icon file to reuse.
- **Create account (doctors only):** `/login` links to `/register`. The form collects first, middle (optional), last name, username, email (optional), phone, area, specialization, password and confirmation. Area and specialization are dropdowns with the same options as the mobile sign-up (`src/lib/options.ts`); choosing "Others" as specialization shows a "Specify specialization" box whose text is sent as the specialization. The server rejects an area that is not in the list. The server fixes `role` to `doctor` and forwards only those fields to `POST auth/register/`. On success the user is signed in and lands on the dashboard. Django field errors (duplicate username, weak password) show next to the field.
- **Out on web:** voice assistant, accessibility TTS dialog, SOS bar, voice trigger and GPS capture. These stay mobile-only.

---

## Acceptance Criteria

- [ ] Doctor logs in at `/login` with valid credentials and lands on `/` showing alerts and patients from the API, with no browser console errors.
- [ ] Invalid credentials show the server's error message and keep the Doctor on `/login`.
- [ ] Unauthenticated visitor to `/` is redirected to `/login`.
- [ ] Refreshing the page keeps the Doctor logged in. Logout clears the session and returns to `/login`.
- [ ] Access token expiry (401) is handled by a silent refresh via the refresh token. If the refresh fails, the Doctor is sent to `/login`.
- [ ] Auth tokens are never readable from page JavaScript (`document.cookie` and web storage show no token).
- [ ] At >= 1024px the Doctor sees two columns (alerts left; patients and quick actions right). Below that the layout is a single column with no horizontal scroll at 360px width.
- [ ] A new unacknowledged alert from a patient appears within 12s without a reload, and the tab title count updates.
- [ ] Doctor can acknowledge an alert of their own patient. It moves to Resolved. A failure shows an error message and leaves the alert active.
- [ ] Doctor can open the map link, copy coordinates, and sees "Location unavailable" plus the error when GPS is missing.
- [ ] Doctor sees the empty states ("no alerts", "no patients") and an error banner when the API fails.
- [ ] Doctor can open Profile and Health Tips, accept or decline an appointment request, and send a message to a patient.
- [ ] Disabled User login on web shows the "use the mobile app" page and a working logout. The dashboard data endpoints are never requested for them.
- [ ] Doctor sees only their own patients' alerts and patients (server-enforced). No other doctor's data renders.
- [ ] Visitor opens `/register` from the login page, creates a doctor account, and lands on the dashboard signed in with the "no alerts" and "no patients" empty states.
- [ ] Registration shows field-level errors for missing fields, mismatched passwords, a taken username and a rejected password, keeps the typed values, and sends one request on a double click.
- [ ] A registration request that sends `role`, `is_staff`, `is_superuser`, `registered_doctor_username` or `disability_type` still creates a plain doctor.
- [ ] A signed-in user visiting `/register` is redirected to `/`.
- [ ] `npm run build`, `npm run lint` and type-check pass. Backend base URL is set only via `API_BASE_URL` in the environment, with no hardcoded host.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| `dikonekti-web/` (Next.js, App Router, TypeScript) | New | Whole web frontend |
| Flutter app (`dikonekti/`) | None | Unchanged; its `web/` target is not used |
| Django backend | None | No endpoint, model or settings change |

### DB / Migration
No DB changes.

### API Contract
No API changes. The web app uses these existing endpoints (under `/api/`):

| Endpoint | Use |
|---|---|
| `POST auth/login/` | Returns `access`, `refresh` and an embedded `profile` |
| `POST auth/refresh/` | Token refresh (refresh tokens rotate) |
| `GET me/` | Current user profile |
| `GET alerts/`, `POST alerts/<id>/acknowledge/` | Doctor sees own patients' alerts. Acknowledge is restricted to the owning doctor |
| `GET patients/` | Doctor-only list of the doctor's patients |
| `GET/POST appointments/`, `PATCH appointments/<id>/status/` | Schedule |
| `GET/POST messages/` | Messages |

### Key Implementation Notes
- **Auth via a Next.js server layer (BFF).** Login and refresh run in Next.js route handlers. They store `access` and `refresh` in `httpOnly`, `Secure`, `SameSite=Lax` cookies. The browser calls only same-origin Next routes, which proxy to Django with the bearer token. **Rejected alternative:** keep JWTs in `localStorage` and call Django directly from the browser. It is cheaper, but any XSS can steal a 30-day refresh token, and it forces a CORS dependency on the backend. The BFF costs a small proxy layer.
- Because the browser never calls Django directly, the backend's `CORS_ALLOW_ALL_ORIGINS = True` is not relied on by this app.
- Role gate: use the `role` field on the profile returned at login. Do not trust it alone for data access. The backend already restricts `patients/` to doctors (`IsDoctor`) and acknowledge to the owning doctor.
- Polling: use a client data-fetching library (e.g. TanStack Query or SWR) with a 12s interval that pauses when the tab is hidden. WebSocket or push is out of scope.
- Health Tips text is static content that also lives in Flutter (`_healthTipsFor`, doctor branch). Copy it into the web app. It can drift from mobile. **Rejected alternative:** a backend endpoint serving tips. It needs a backend change that is out of scope here.
- Alert JSON fields: `id`, `patient_username`, `patient_name`, `patient_area`, `patient_phone_number`, `disability_type`, `latitude`, `longitude`, `location_error`, `timestamp`, `acknowledged`. Mirror the types of `EmergencyAlert` in `emergency_alert.dart`.
- Keep the web app in its own folder (`dikonekti-web/`), not `dikonekti/web/`, which belongs to the Flutter project.

---

## Out of Scope

- A Disabled User dashboard on web (separate follow-up ticket).
- Voice assistant, TTS, accessibility settings dialog, SOS, voice trigger and GPS capture on web.
- New desktop-only widgets such as stats, charts or embedded maps.
- Registration of Disabled Users on web (patients register in the mobile app). Doctor registration is in scope, see the Scope note.
- Doctor verification or approval (anyone can currently register as a doctor, same as in the mobile app).
- Backend changes, including tightening `CORS_ALLOW_ALL_ORIGINS`, WebSocket or push alerts, and a tips endpoint.
- Production hosting, CI and domain setup.
- Removing Flutter's `web/` target or the duplicate nested folders (`dikonekti/dikonekti`, `dikonekti/Dikonekt_Backend`).

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `dikonekti-web/package.json`, `tsconfig.json`, `next.config.ts` | New |
| `dikonekti-web/.env.example` | New (`API_BASE_URL`) |
| `dikonekti-web/src/app/layout.tsx` | New |
| `dikonekti-web/src/app/login/page.tsx` | New |
| `dikonekti-web/src/app/page.tsx` | New (dashboard) |
| `dikonekti-web/src/app/unsupported/page.tsx` | New (Disabled User message) |
| `dikonekti-web/src/app/api/auth/login/route.ts` | New |
| `dikonekti-web/src/app/api/auth/logout/route.ts` | New |
| `dikonekti-web/src/app/api/[...path]/route.ts` | New (authenticated proxy with silent refresh) |
| `dikonekti-web/src/app/register/page.tsx`, `RegisterForm.tsx` | New (doctor registration) |
| `dikonekti-web/src/app/api/auth/register/route.ts` | New (fixes role to doctor, signs in) |
| `dikonekti-web/src/app/icon.svg`, `src/lib/brand.ts`, `src/components/BrandMark.tsx`, `BrandHeader.tsx` | New (brand mark, tab icon; scaffold `favicon.ico` deleted) |
| `dikonekti-web/src/lib/options.ts` | New (copy of the mobile area and specialization lists) |
| `dikonekti-web/src/lib/field-errors.ts` | New (flattens Django field errors) |
| `dikonekti-web/src/lib/django.ts`, `src/lib/config.ts` | New (the one server-side Django client: base URL, headers, timeout; `ConfigError`) |
| `dikonekti-web/src/lib/schemas/auth.ts` | New (Zod schemas for login and registration, shared by the forms and the API routes) |
| `dikonekti-web/src/hooks/useSingleFlight.ts`, `src/components/dashboard/hooks/useNow.ts` | New (double-submit guard; shared 30s clock for relative times) |
| `dikonekti-web/src/proxy.ts` | New (redirect unauthenticated users; keeps `/login` and `/register` public; Next 16 name for middleware) |
| `dikonekti-web/src/app/api/auth/refresh/route.ts` | New (POST only: refreshes the session cookies, or clears them on failure) |
| `dikonekti-web/src/app/session-expired/page.tsx`, `SessionRefresher.tsx` | New (client page that POSTs the refresh once, then returns home or to login) |
| `dikonekti-web/src/lib/auth/django-session.ts` | New (login and doctor-only register calls to Django, session payload validation) |
| `dikonekti-web/vitest.config.mts`, `vitest.setup.ts`, `vitest.server-only.ts` | New (test setup) |
| `.ai/context.md`, `.ai/specs/DIK-001.md` | New (module map; implementation spec) |
| `dikonekti-web/src/lib/api.ts`, `src/lib/types.ts` | New |
| `dikonekti-web/src/components/dashboard/*` | New (alert card, patient card, quick actions, dialogs) |

---

## Scope note

- Tokens are kept for Disabled Users (see Approved Design) because the "use the mobile app" page needs a session for its logout button.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`. The file list above reflects that.
- Doctor registration on web was added after approval at the user's request (it was listed as out of scope). The backend `POST auth/register/` already existed, so there are no backend or schema changes. The role is forced server-side; Disabled User registration stays mobile-only.
- Anyone can register as a doctor and patients can pick any doctor, exactly as in the mobile app. Verification of doctors is a separate ticket.
- `src/lib/options.ts` copies the mobile lists (area, specialization) so stored values match. The mobile area list repeats "Kibweni" (listed once on web) and spells "jumbi" in lower case (kept as is). Keep both apps in step.
- The brand glyph is Material `volunteer_activism` (round) from `@material-design-icons/svg` (Apache-2.0), the same icon the mobile login screen uses. Colors `#6750A4` to `#9B7FE8` are copied from `login_page.dart`.
- Code review (DIK-001, `/code-review-3`) fixes: alert ages tick every 30s from one shared timer; `proxyUrl` keeps the whole query; patients refresh every 5 minutes instead of every 12s; a single server-side Django client and browser `apiFetch` replace nine raw `fetch` calls; forms use React Hook Form + Zod with one schema shared with the routes (company web rules); one `useSingleFlight` hook replaces six copies of the double-submit guard; a token Django rejects now triggers one POSTed refresh attempt (`/session-expired` page, `/api/auth/refresh`) before the user is signed out, and nothing changes the session on a GET; unused starter assets removed.
