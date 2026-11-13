# DIK-007: Disabled User dashboard on web

**Type:** Feature
**Priority:** Medium
**Platform:** Next.js web (`dikonekti-web/`)
**Depends on:** None

---

## Problem Statement

A Disabled User who logs in on the web today sees a "use the mobile app" page (DIK-001). Patients who are at a computer, or whose phone is unavailable, cannot send an emergency alert, see their doctor, request an appointment or message their doctor. The mobile app already supports all of that, so the web experience for patients is a dead end.

---

## User Stories

- As a **Disabled User**, I want to send an emergency alert from the web, with my location when the browser allows it, so that my doctor is told I need help.
- As a **Disabled User**, I want to see my doctor's details, so that I know who will receive my alert.
- As a **Disabled User**, I want to request an appointment and see its status, so that I can plan a visit.
- As a **Disabled User**, I want to message my doctor and read the replies, so that I can ask questions.
- As a **Disabled User**, I want to read my profile and health tips, so that I can check my details and stay safe.

---

## Approved Design / Behaviour

This mirrors the mobile `DisabledUserDashboard`. A Disabled User who logs in lands on `/` and sees:

```
+ Header: My Dashboard                                         [Log out] +
| Welcome header (greeting, name)                                         |
| (notice, only if no doctor)  You have no doctor registered...           |
| Quick Actions   My Doctor | My Profile | Schedule | Messages | Tips    |
+-------------------------------------------------------------------------+
| [ SOS  Send emergency alert ]   <- pinned to the bottom of the screen   |
+-------------------------------------------------------------------------+
```

**Emergency alert (SOS).**

- A large, always visible button pinned at the bottom. It opens a confirmation dialog, "Send Emergency Alert? Your doctor will be notified immediately and sent your location if available", with **Send Alert** and **Cancel**.
- On Send Alert the browser asks for location (up to 10 seconds, high accuracy). If it is refused, unavailable or times out, the alert is sent anyway with the reason in `location_error`, exactly as the mobile app does.
- The result is announced in a live region and shown as a message: sent with location; sent without location (with the reason); sent but "no doctor is registered to you, so no doctor will receive it"; or the server's message (for example the phone number is missing from the profile).
- The button is disabled while sending, and a double click sends one alert.

**My Doctor** opens a panel with the doctor's name, specialization, area, phone (a call link) and email, or "No doctor is registered to your account yet." **My Profile** shows the patient's own details, including disability type and registered doctor. **Health Tips** shows the mobile tips for the patient's disability type (the same list as the app).

**Schedule.** Lists the patient's appointment requests with their status (Pending, Confirmed, Declined) and a **Request** form with date, time and reason (up to 255 characters). The date cannot be in the past or more than 180 days ahead (as on mobile). Submitting creates a pending request.

**Messages.** The single thread with the patient's doctor, oldest first, a composer (up to 2,000 characters once DIK-002 lands), and polling every 12 seconds. With no doctor, it shows "No doctor is registered to you yet."

**Behavior that changes from DIK-001.** A Disabled User no longer sees the "use the mobile app" page. That page remains only for a role the web app does not know, and its text becomes generic ("This account cannot use the web app. Please use the Dikonekti mobile app.").

**Registration.** Disabled Users still register in the mobile app. The web registration page stays doctor-only.

---

## Acceptance Criteria

- [ ] A Disabled User who logs in lands on a dashboard with the welcome header, the five quick actions and the pinned SOS button, and never sees the "use the mobile app" page.
- [ ] Choosing SOS opens the confirmation dialog, and Cancel sends nothing.
- [ ] Confirming with location allowed sends one alert containing latitude and longitude, and shows the sent message. The doctor sees it within 12 seconds on their dashboard.
- [ ] Confirming with location blocked, unsupported or timed out sends the alert with `location_error` set and tells the patient the alert was sent without location.
- [ ] A patient with no registered doctor sees the notice, and sending an alert shows the "no doctor will receive it" result instead of "sent to your doctor".
- [ ] A patient whose profile has no phone number gets the server's message and no success state.
- [ ] Double-clicking Send Alert sends one alert, and the button is disabled while it is in flight.
- [ ] My Doctor shows the doctor's details with a working call link, or the no-doctor message. My Profile shows the patient's details. Health Tips shows the tips for the patient's disability type.
- [ ] Requesting an appointment for tomorrow succeeds and appears as Pending. A past date or a date more than 180 days away cannot be submitted. A reason over 255 characters cannot be submitted.
- [ ] The Messages thread shows both sides in time order, a sent message appears immediately, a blank message cannot be sent, and a doctor's reply appears within 12 seconds.
- [ ] A Doctor or Admin visiting the patient dashboard is not shown it, and a Disabled User cannot reach doctor or admin pages or call the doctor-only endpoints (the server returns `403`).
- [ ] The dashboard can be used with the keyboard only, buttons have visible focus, errors use `role="alert"`, and the SOS result is announced to screen readers.
- [ ] At 360 px width there is no horizontal scroll and the SOS button stays reachable.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Next.js web: `src/app` | Modified | Home page renders the patient dashboard; unsupported page copy |
| Next.js web: `src/components/patient` | New | Dashboard, SOS, dialogs |
| Next.js web: `src/lib` | Modified / New | Route decisions, allowlist, geolocation helper, tips, schemas |
| Django backend, Flutter app | None | Uses existing endpoints |

### DB / Migration
No DB changes.

### API Contract
Uses existing endpoints with the patient token: `GET me`, `POST alerts` (`latitude`, `longitude`, `location_error`), `GET appointments`, `POST appointments` (`requested_time`, `reason`), `GET messages`, `POST messages` (`body`). The proxy allowlist currently permits none of the patient writes; this ticket adds `POST alerts` and `POST appointments`.

### Key Implementation Notes
- **Browser location needs a secure context.** `navigator.geolocation` works only on HTTPS (and `localhost`). The deployment ticket must serve the web app over HTTPS, or every web alert will go out without location. State this in the PR description.
- Wrap geolocation in one helper that never throws and returns coordinates or an error string, like the mobile `LocationService`, and always sends the alert.
- **SOS is safety-critical.** Use the shared `useSingleFlight` guard, a confirmation step, and show an explicit failure state if the request fails (do not close the dialog silently). Do not retry automatically, to avoid duplicate alerts.
- The health tips are a copy of the mobile `_healthTipsFor` non-doctor branch, kept in a new file and noted in the README as a list to keep in step with the app, like the doctor tips.
- `decideRoute` gains a `patient` decision. It is also edited by DIK-004 (verification) and DIK-006 (admin); the cases are separate and whichever lands second rebases.
- Reuse the dashboard data hooks, dialog, `useSingleFlight`, `useNow` and the shared Zod and API client; add patient-specific components rather than generalising the doctor ones prematurely.
- Rejected alternative: leave Disabled Users on the notice page and tell them to use the phone. It costs nothing, but it leaves patients without a working emergency path on the web.

---

## Out of Scope

- Voice assistant (text-to-speech announcements) and the voice trigger word for SOS. The trigger depends on the browser speech API (Chrome only), microphone permission and background listening, and false triggers on an emergency button need their own safety design. Separate ticket.
- Accessibility settings dialog (font size, voice settings).
- Registering a Disabled User on web, or editing the profile, or choosing or changing a doctor.
- Push or sound notifications when a doctor replies.
- Offline queueing of alerts.

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `dikonekti-web/src/lib/route-gate.ts`, `route-gate.test.ts` | Modified (`patient` decision) |
| `dikonekti-web/src/app/page.tsx` | Modified (render the patient dashboard) |
| `dikonekti-web/src/app/unsupported/page.tsx` | Modified (generic text) |
| `dikonekti-web/src/components/patient/PatientDashboard.tsx`, `SosBar.tsx`, `SosConfirmDialog.tsx`, `DoctorPanel.tsx`, `PatientProfileDialog.tsx`, `PatientScheduleDialog.tsx`, `PatientMessagesDialog.tsx`, `PatientTipsDialog.tsx` | New |
| `dikonekti-web/src/components/patient/hooks/usePatientData.ts` | New |
| `dikonekti-web/src/lib/geolocation.ts`, `geolocation.test.ts` | New |
| `dikonekti-web/src/lib/patient-tips.ts` | New |
| `dikonekti-web/src/lib/schemas/appointment.ts` | New (date window, reason length) |
| `dikonekti-web/src/lib/types.ts` | Modified (doctor summary in the profile) |
| `dikonekti-web/src/lib/proxy-path.ts`, `proxy-path.test.ts` | Modified (`POST alerts`, `POST appointments`) |
| `dikonekti-web/README.md` | Modified |
