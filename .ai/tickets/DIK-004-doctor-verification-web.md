# DIK-004: Doctor verification screens on web

**Type:** Feature
**Priority:** High
**Platform:** Next.js web (`dikonekti-web/`)
**Depends on:** DIK-003 (verification endpoints and `verification_status` in the profile)

---

## Problem Statement

After DIK-003, a doctor whose certificate has not been approved is blocked from every doctor endpoint, so today the web dashboard would show errors for them. A doctor who registers on the web has no way to upload the confirmation letter or certificate, see whether it was approved, or fix a rejection. The web app also cannot forward file uploads, because its proxy reads request bodies as text.

---

## User Stories

- As a **Doctor** who just registered, I want to be taken to a screen that asks me to upload my confirmation letter or certificate, so that I know what is needed to start using the app.
- As a **Doctor** waiting for review, I want to see that my document is under review and when I submitted it, so that I know nothing more is needed.
- As a **Doctor** whose document was rejected, I want to read the reason and upload a new file, so that I can fix it.
- As a **Doctor** who is approved, I want to go straight to my dashboard, so that verification never gets in my way again.

---

## Approved Design / Behaviour

**Routing.** After login, the home page checks the doctor's `verification_status` from `GET /api/me/`:

| Status | Where the doctor lands |
|---|---|
| `approved` | the dashboard (`/`), as today |
| `not_submitted`, `pending`, `rejected` | `/verification` |

A doctor who is not approved and opens `/` is redirected to `/verification`. An approved doctor who opens `/verification` is redirected to `/`.

**The `/verification` screen** shows the brand header, the doctor's name, a Log out button and one panel per status:

```
not_submitted   Upload your confirmation letter or certificate
                [ Choose file ]  PDF, JPG or PNG, up to 5 MB      [ Submit for review ]

pending         Your document is under review
                Submitted 13 Nov 2026, 10:42. We will unlock your dashboard once it is approved.
                (this panel refreshes every 30 seconds and moves on when approved)

rejected        Your document was not accepted
                Reason: <rejection reason from the reviewer>
                [ Choose file ]  PDF, JPG or PNG, up to 5 MB      [ Submit again ]
```

- The file input checks the type and size in the browser before sending and shows "Choose a PDF, JPG or PNG file." or "The file is larger than 5 MB." The server checks again.
- During upload the button is disabled and shows "Uploading…". A failed upload shows the server's message and keeps the page usable.
- On success the panel switches to the pending state without a reload.

**Registration copy.** The `/register` page tells the doctor: "After you create your account you will upload your confirmation letter or certificate. You can use the app once it is approved."

**Revoked mid-session.** If a dashboard request returns `403` with code `verification_required` (for example an admin revokes the doctor while the dashboard is open), the app sends the doctor to `/verification`.

**Uploads through the proxy.** The same-origin proxy forwards the multipart body as bytes, unchanged, and the browser client sends a `FormData` object without forcing a JSON content type.

---

## Acceptance Criteria

- [ ] A newly registered doctor lands on `/verification` showing the upload panel, never on the dashboard.
- [ ] A doctor with status `pending` sees the under-review panel with the submitted date and no upload form. The panel updates to the dashboard within about 30 seconds of an admin approving, without the doctor reloading.
- [ ] A doctor with status `rejected` sees the reviewer's reason and an upload form. Submitting a valid file moves the panel to under review.
- [ ] An approved doctor who opens `/verification` is redirected to `/`. A doctor who is not approved and opens `/` is redirected to `/verification`.
- [ ] Choosing a `.docx`, a 6 MB PDF, or no file is blocked in the browser with the messages above and sends no request.
- [ ] A valid 1 MB PDF, a JPG and a PNG upload successfully, and the file arrives at Django byte-for-byte identical (checked by comparing hashes in a test).
- [ ] A server error on upload (for example `400` for a disguised file) shows its message, re-enables the button and keeps the chosen file selectable.
- [ ] A doctor who is revoked while the dashboard is open is sent to `/verification` on the next refresh, not shown a broken dashboard.
- [ ] A server refusal of the upload is shown in plain words, never Django's raw text: `429` shows "Too many uploads. Please wait a while and try again." and `413` shows "The file is larger than 5 MB." The form stays usable.
- [ ] Double-clicking Submit sends one upload request.
- [ ] The Disabled User and unknown-role behavior from DIK-001 is unchanged by this ticket.
- [ ] Doctors with no JavaScript-visible tokens: cookies remain `httpOnly` and the document is never readable by the page after upload.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Next.js web: `src/app` | Modified / New | `/verification` page, home page gating, register copy |
| Next.js web: `src/lib` | Modified | Route decisions, allowlist, proxy body handling, API client, types |
| Next.js web: `src/components` | New | Verification panels and upload form |
| Django backend, Flutter app | None | |

### DB / Migration
No DB changes.

### API Contract
Uses `GET /api/me/` (new `verification_status`), `GET` and `POST /api/me/verification/` from DIK-003. Adds `GET me/verification` and `POST me/verification` to the proxy allowlist.

### Key Implementation Notes
- **The proxy must stop reading bodies as text.** `src/app/api/[...path]/route.ts` currently calls `request.text()`, which corrupts binary uploads. Read the body as bytes and pass it to Django unchanged, with the original `Content-Type` including the multipart boundary. `djangoRequest` in `src/lib/django.ts` gains a bytes body option. Cap the body at 6 MB in the proxy so a huge upload is refused before it is buffered.
- `apiFetch` must not set `Content-Type` when the body is `FormData`; the browser sets it with the boundary.
- **Route decisions.** `decideRoute` gains a `verification` decision for a doctor who is not approved. This ticket owns that change to `src/lib/route-gate.ts` and the home page. DIK-006 later adds the admin case and DIK-007 the patient case; they are different decisions and land after this one.
- The `Profile` type gains `verification_status`. The profile in `/api/me/` is the single source: do not infer verification from a failed request.
- Handle `verification_required` in the shared dashboard data layer (one place) rather than in each component.
- Form validation for the file uses a Zod schema like the other forms (company web rules).
- DIK-003 limits uploads to 10 per hour per doctor (`429`) and refuses a declared body over 6 MB with `413`. Map both to fixed messages in the upload helper (as DIK-002 did for the login `429`), so Django's "Expected available in N seconds" wording is never shown.
- Allowlist rows: this ticket adds only the two `me/verification` rows; other tickets add their own.

---

## Out of Scope

- The admin review screen (DIK-006).
- Showing or previewing the uploaded document back to the doctor.
- Email or push notification when the document is approved or rejected.
- A history of earlier submissions.
- Verification on the mobile app (DIK-005).
- Drag-and-drop upload or image cropping.

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `dikonekti-web/src/lib/route-gate.ts`, `route-gate.test.ts` | Modified (`verification` decision) |
| `dikonekti-web/src/app/page.tsx` | Modified (redirect unverified doctors) |
| `dikonekti-web/src/app/verification/page.tsx` | New |
| `dikonekti-web/src/components/verification/VerificationPanel.tsx`, `UploadForm.tsx` | New |
| `dikonekti-web/src/lib/schemas/verification.ts` | New (file type and size rules) |
| `dikonekti-web/src/lib/types.ts` | Modified (`verification_status`, verification record type) |
| `dikonekti-web/src/lib/proxy-path.ts`, `proxy-path.test.ts` | Modified (two `me/verification` rows) |
| `dikonekti-web/src/app/api/[...path]/route.ts`, `route.test.ts` | Modified (binary request body, size cap) |
| `dikonekti-web/src/lib/django.ts`, `django.test.ts` | Modified (bytes body) |
| `dikonekti-web/src/lib/api-client.ts`, `api-client.test.ts` | Modified (`FormData` support) |
| `dikonekti-web/src/components/dashboard/hooks/useDashboardData.ts` | Modified (`verification_required` handling) |
| `dikonekti-web/src/app/register/page.tsx` | Modified (copy) |
| `dikonekti-web/README.md` | Modified |
