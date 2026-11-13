# DIK-005: Doctor verification screens in the Flutter app

**Type:** Feature
**Priority:** High
**Platform:** Flutter app (`dikonekti/`)
**Depends on:** DIK-003 (verification endpoints and `verification_status` in the profile)

---

## Problem Statement

Doctors also register and work in the mobile app. After DIK-003, a doctor whose certificate is not approved is blocked from patients, alerts, appointments and messages, so the doctor dashboard would show errors, and there is no screen to upload the confirmation letter or certificate, check its status, or resubmit after a rejection. Disabled Users choosing a doctor at sign-up will also see only approved doctors, which can leave the dropdown empty.

---

## User Stories

- As a **Doctor** who just registered in the app, I want a clear screen asking for my confirmation letter or certificate, so that I know what to do next.
- As a **Doctor** waiting for review, I want to see the status and submission date, so that I know it is being reviewed.
- As a **Doctor** whose document was rejected, I want to read the reason and send a new file from my phone, so that I can fix it.
- As a **Disabled User** signing up, I want a clear message if no verified doctor is available yet, so that I understand why I cannot pick one.

---

## Approved Design / Behaviour

**Routing.** `DashboardPage` shows the doctor dashboard only when the doctor's `verification_status` is `approved`. For `not_submitted`, `pending` and `rejected` it shows a new `VerificationPage`. Disabled Users are not affected.

**The verification screen** has the app bar (title "Verification", Log out) and one card per status, using the existing doctor styling:

```
not_submitted   Upload your confirmation letter or certificate
                PDF, JPG or PNG, up to 5 MB
                [ Choose file ]   (file name shown once chosen)
                [ Submit for review ]

pending         Your document is under review
                Submitted 13 Nov 2026, 10:42
                (checks every 30 seconds; opens the dashboard when approved)

rejected        Your document was not accepted
                Reason: <rejection reason>
                [ Choose file ]  [ Submit again ]
```

- Choosing a file opens the system file picker restricted to PDF, JPG and PNG. A file over 5 MB is refused on the phone with "The file is larger than 5 MB."
- Uploading shows a progress indicator on the button and disables it. A failure shows a snackbar with the server's message and keeps the screen usable.
- Pull-to-refresh re-checks the status.
- The voice assistant, when on, reads the status as the screen opens, like the other screens.

**Revoked while using the app.** If a doctor request returns `403` with code `verification_required`, the app returns to the verification screen.

**Sign-up for Disabled Users.** The doctor dropdown shows only verified doctors (the backend filters). If the list is empty it shows "No verified doctors are available yet. You can add one later from your profile." and sign-up still works without a doctor, as it does today.

**Sign-up for Doctors.** The success message says: "Account created. Next, upload your confirmation letter or certificate."

---

## Acceptance Criteria

- [ ] A newly registered doctor lands on the verification screen with the upload card, not the dashboard.
- [ ] A doctor with `pending` sees the under-review card with the submitted date and no upload button, and is taken to the dashboard within about 30 seconds of approval without reopening the app.
- [ ] A doctor with `rejected` sees the reviewer's reason and can upload again; after a successful upload the card shows under review.
- [ ] An approved doctor goes straight to the dashboard and never sees the verification screen.
- [ ] The file picker offers only PDF, JPG and PNG. A file over 5 MB is refused with the message above and nothing is sent.
- [ ] The upload sends the file unchanged as a multipart request, and a failed upload shows the server's message.
- [ ] A doctor revoked while using the app is returned to the verification screen on the next request.
- [ ] A refused upload is shown in plain words: a `429` shows "Too many uploads. Please wait a while and try again." and a `413` shows "The file is larger than 5 MB.", not Django's raw text.
- [ ] Double-tapping Submit sends one request.
- [ ] A Disabled User signing up sees verified doctors only, and sees the empty-list message when there are none, and can still create the account.
- [ ] Disabled User screens behave exactly as before.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Flutter app: `lib/screens` | Modified / New | `VerificationPage`, dashboard routing, sign-up copy |
| Flutter app: `lib/services` | Modified / New | Multipart upload, verification API service |
| Flutter app: `lib/models` | Modified | `verificationStatus` on the user account |
| Django backend, Next.js web | None | |

### DB / Migration
No DB changes.

### API Contract
Uses `GET /api/me/` (new `verification_status`), `GET` and `POST /api/me/verification/`, and the filtered `GET /api/doctors/` from DIK-003.

### Key Implementation Notes
- `ApiClient` only sends JSON today. Add a multipart helper that keeps the bearer token, the silent refresh-on-401 retry and the existing error-message extraction. Do not duplicate that logic in a new service.
- Add the `file_picker` package for choosing a file. Check the Android and iOS manifest/plist entries it needs for the pinned version.
- Put the status polling and the `verification_required` handling in one place (the verification page and `ApiClient`), not in each dashboard widget.
- `ApiClient` currently shows Django's `detail` text, which for a throttled request reads "Request was throttled. Expected available in N seconds.". DIK-003 adds a `429` (10 uploads per hour) and a `413` (body over 6 MB) to the upload, so map those two statuses to the fixed messages in the verification service.
- Follow the existing doctor dashboard styling and the `Semantics` and voice-assistant conventions used in `dashboard_components.dart`.
- The Flutter project contains duplicate nested folders (`dikonekti/dikonekti`). Edit only the top-level project.

---

## Out of Scope

- The admin review screen and any admin features in the mobile app.
- Previewing the uploaded document in the app.
- Push or email notifications for decisions.
- Camera capture of the document (only choosing an existing file).
- Web verification screens (DIK-004).

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `dikonekti/lib/models/user_account.dart` | Modified (`verificationStatus`) |
| `dikonekti/lib/models/doctor_verification.dart` | New |
| `dikonekti/lib/services/verification_api_service.dart` | New |
| `dikonekti/lib/services/api_client.dart` | Modified (multipart helper, `verification_required` error) |
| `dikonekti/lib/screens/verification_page.dart` | New |
| `dikonekti/lib/screens/dashboard_page.dart` | Modified (route unverified doctors) |
| `dikonekti/lib/screens/create_account_page.dart` | Modified (empty doctor list message, doctor success message) |
| `dikonekti/pubspec.yaml`, `pubspec.lock` | Modified (`file_picker`) |
| `dikonekti/android/app/src/main/AndroidManifest.xml`, `dikonekti/ios/Runner/Info.plist` | Modified only if the picker version requires it |
| `dikonekti/test/` | New (model parsing, routing, upload service tests) |
