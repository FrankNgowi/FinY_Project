# DIK-006: Admin review of doctor certificates on web

**Type:** Feature
**Priority:** High
**Platform:** Next.js web (`dikonekti-web/`)
**Depends on:** DIK-003 (admin role and review endpoints), DIK-004 (verification routing and binary-safe proxy)

---

## Problem Statement

DIK-003 adds an `admin` role and the endpoints to review doctors' certificates, but an Admin who logs in to the web app today would be sent to the "use the mobile app" page, and there is no screen to see which doctors are waiting, open their documents, or approve and reject them. Without it, no doctor can ever be approved except by staff using Django admin directly.

---

## User Stories

- As an **Admin**, I want to log in and see the doctors waiting for review, oldest first, so that nobody waits longer than necessary.
- As an **Admin**, I want to open a doctor's uploaded document next to their details, so that I can check the name, specialization and credentials.
- As an **Admin**, I want to approve a doctor, or reject with a written reason, so that the doctor knows what to fix.
- As an **Admin**, I want to revoke a previously approved doctor, so that someone who should no longer practise stops receiving alerts.

---

## Approved Design / Behaviour

**Routing.** An Admin who logs in lands on `/admin/verifications`. An Admin who opens `/` is redirected there. A Doctor or Disabled User who opens any `/admin/...` page is redirected to their own home. An unauthenticated visitor goes to `/login`.

**The `/admin/verifications` screen** has the brand header, "Doctor verification", the admin's name and Log out, then:

```
[ Pending (3) ] [ Approved ] [ Rejected ] [ All ]

+ Dr. Jane Doe  - Vision - Stone Town ------------- submitted 2 h ago +
| username jane   phone +254700000001   email jane@example.test      |
| [ View document ]                       [ Approve ] [ Reject ]     |
+--------------------------------------------------------------------+
```

- The default tab is Pending, oldest submission first. Each tab shows a count and a "Nothing waiting for review." empty state.
- **View document** opens the file in a new browser tab through the authenticated proxy. A PDF or image displays inline; the page never gets the file's real storage path.
- **Approve** asks for no extra input and moves the record to Approved.
- **Reject** opens a dialog with a required reason (up to 500 characters, with a counter) and a Reject button. Rejecting an Approved doctor is labelled "Revoke approval" and also needs a reason.
- After a decision the row moves to its new tab without a reload. A conflict (`409`, because another admin already decided) shows "This request was already decided by someone else." and refreshes the list.
- The list refreshes every 30 seconds.

---

## Acceptance Criteria

- [ ] An Admin logging in lands on `/admin/verifications`, and opening `/` redirects there.
- [ ] A Doctor and a Disabled User opening `/admin/verifications` are redirected away, and the admin API calls they could try return `403`.
- [ ] The Pending tab lists pending doctors oldest first with name, specialization, area, phone, email and time submitted, and shows the empty state when there are none.
- [ ] Clicking View document opens a PDF, a JPG and a PNG in a new tab and they display correctly, from the admin session only. The same URL opened while logged out or as a Doctor does not return the file.
- [ ] Approving moves the doctor out of Pending into Approved, and that doctor's dashboard unlocks (checked end to end with DIK-004).
- [ ] Rejecting requires a reason: an empty reason, whitespace only, or 501 characters cannot be submitted. A valid reason moves the doctor to Rejected and the doctor sees it on their verification screen.
- [ ] Revoking an Approved doctor needs a reason, moves them to Rejected, and the doctor is locked out of the dashboard.
- [ ] A decision on a record another admin already decided shows the conflict message and refreshes.
- [ ] Double-clicking Approve or Reject sends one request.
- [ ] A failed request (server down) shows an error banner with Retry and keeps the list visible.
- [ ] Cookies remain `httpOnly` and the proxy still rejects any path outside its allowlist.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Next.js web: `src/app/admin` | New | Review page |
| Next.js web: `src/components/admin` | New | List, row, reject dialog |
| Next.js web: `src/lib` | Modified | Route decisions, allowlist, proxy response handling, types |
| Django backend, Flutter app | None | |

### DB / Migration
No DB changes.

### API Contract
Uses the admin endpoints from DIK-003: `GET admin/verifications?status=`, `GET admin/verifications/<id>/document`, `POST admin/verifications/<id>/approve` and `.../reject`. Adds those four rows to the proxy allowlist.

### Key Implementation Notes
- **The proxy must pass binary responses through.** `toResponse` in `src/app/api/[...path]/route.ts` currently only relays JSON and replaces anything else with a generic error. The document endpoint returns a PDF or image, so it needs a streaming passthrough that keeps `Content-Type`, `Content-Disposition`, `X-Content-Type-Options` and `Content-Security-Policy` from Django, for that one path only. DIK-004 changes the same file for request bodies; this ticket changes only the response side and lands after it.
- `src/lib/route-gate.ts` (introduced with the `verification` decision in DIK-004) gains an `admin` decision here. `decideRoute` is also edited by DIK-007 for patients; the cases are separate and whichever lands second rebases.
- The admin pages are server-gated on the `admin` role like the home page; Django still enforces it on every endpoint.
- Opening the document in a new tab uses a same-origin URL (`/api/admin/verifications/<id>/document`), so the session cookie authorizes it and no token is placed in a URL.
- Reject reason form uses React Hook Form and Zod like the other forms.

---

## Out of Scope

- Creating Admin accounts (done with the `create_admin` command in DIK-003).
- A history of decisions, audit log screen, or search and filter by name.
- Emails or notifications to doctors.
- Bulk approve or reject.
- Admin features in the mobile app.

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `dikonekti-web/src/lib/route-gate.ts`, `route-gate.test.ts` | Modified (`admin` decision) |
| `dikonekti-web/src/app/page.tsx` | Modified (redirect admins) |
| `dikonekti-web/src/app/admin/verifications/page.tsx` | New |
| `dikonekti-web/src/components/admin/VerificationList.tsx`, `VerificationRow.tsx`, `RejectDialog.tsx` | New |
| `dikonekti-web/src/components/admin/hooks/useVerifications.ts` | New |
| `dikonekti-web/src/lib/schemas/verification.ts` | Modified (reject reason rule) |
| `dikonekti-web/src/lib/types.ts` | Modified (admin record type) |
| `dikonekti-web/src/lib/proxy-path.ts`, `proxy-path.test.ts` | Modified (four admin rows) |
| `dikonekti-web/src/app/api/[...path]/route.ts`, `route.test.ts` | Modified (binary response passthrough for the document path) |
| `dikonekti-web/README.md` | Modified |
