# DIK-003: Doctor verification by certificate, with an admin review role (backend)

**Type:** Feature
**Priority:** High
**Platform:** Django backend (`Dikonekt_Backend/dikonekti/`)
**Depends on:** DIK-002 (environment-based settings; this ticket adds a required storage setting in the same style)

---

## Problem Statement

Anyone can register as a doctor and is trusted immediately. Patients can pick any doctor at sign-up, `GET /api/doctors/` lists every doctor publicly, and `EmergencyAlert` is routed straight to `patient.registered_doctor`, so an unverified person receives real emergency alerts and can read patients' details and messages. There is also no way for anyone to check a doctor's credentials, and no app role that can. This ticket adds certificate-based verification and an `admin` role that reviews it. The web and mobile screens come in DIK-004, DIK-005 and DIK-006.

---

## User Stories

- As a **Doctor**, I want to upload my confirmation letter or certificate and see whether it was approved, so that I can start receiving patients and alerts.
- As a **Doctor** whose document was rejected, I want to see the reason and upload a corrected document, so that I am not stuck.
- As an **Admin**, I want to list pending doctors, open their uploaded document and approve or reject it with a reason, so that only real doctors are trusted.
- As a **Disabled User**, I want to see only verified doctors when choosing mine, so that my emergency alerts go to a real doctor.

---

## Approved Design / Behaviour

**New role: `admin`.** Admins use the same login as everyone else. They cannot be created through public registration (the register endpoint still accepts only `doctor` and `disabled`). They are created by staff with a management command, `python manage.py create_admin <username>`, which prompts for a password, and can also be set in Django admin.

**Verification record.** Every doctor has one verification record with a status:

| Status | Meaning |
|---|---|
| `not_submitted` | Registered, no document uploaded yet |
| `pending` | A document was uploaded and awaits review |
| `approved` | An admin accepted it |
| `rejected` | An admin refused it (with a reason) or later revoked approval |

The doctor's current status is returned in the profile as `verification_status` (for any other role it is `null`).

**Doctor submits a document.** `POST /api/me/verification/` with one file field `document` (multipart). Allowed only when the status is `not_submitted` or `rejected`. Accepted types are PDF, JPEG and PNG, up to 5 MB. The type is checked from the file's first bytes, not from the name or the declared content type. On success the status becomes `pending`, the old rejection reason is cleared, and a previous file, if any, is deleted. Files are stored under a private directory with random names and are never served from a public URL.

**Doctor reads the status.** `GET /api/me/verification/` returns the status, the time submitted and the rejection reason if any. It never returns the file.

**Admin review** (admin role only):

- `GET /api/admin/verifications/?status=pending` lists records (default `pending`; also `approved`, `rejected`, `all`) with the doctor's name, username, specialization, area, phone, email, status and times, oldest submission first.
- `GET /api/admin/verifications/<id>/document/` streams the uploaded file for viewing, only to an authenticated admin, with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`.
- `POST /api/admin/verifications/<id>/approve/` moves `pending` to `approved`.
- `POST /api/admin/verifications/<id>/reject/` with `{"reason": "..."}` (required, up to 500 characters) moves `pending` or `approved` to `rejected`. From `approved` this is a revocation.
- Approving or rejecting a record already in the target state returns `409`. Every decision records the reviewing admin and the time.

**What an unverified doctor can do.** A doctor whose status is not `approved` can log in, read `/api/me/` and `/api/me/verification/`, and upload a document. Every other doctor endpoint returns `403` with `{"detail": "Your account is awaiting verification.", "code": "verification_required"}`: patients, alerts (list and acknowledge), appointments (list and status change) and messages.

**Patients and alerts.**

- `GET /api/doctors/` lists approved doctors only.
- Registering a Disabled User with `registered_doctor_username` of a doctor who is not approved fails with a field error on that field.
- When a doctor leaves `approved` (revocation), every patient registered with that doctor has their `registered_doctor` cleared. The mobile and web apps already tell a patient with no doctor to choose one, and an alert sent without a doctor is saved but reaches nobody, with the existing explanatory message.
- A new alert is routed to the patient's doctor only if that doctor is approved.

**Existing doctors.** The data migration marks every existing doctor `approved`, so nobody is locked out on release. Admins can revoke any of them afterwards.

---

## Acceptance Criteria

- [ ] A new doctor registers with status `not_submitted`, and `/api/me/` shows `verification_status: "not_submitted"`. A Disabled User and an Admin show `null`.
- [ ] A doctor uploads a valid 1 MB PDF, JPEG or PNG and the status becomes `pending`. The response and `GET /api/me/verification/` never contain a file path or URL.
- [ ] A file over 5 MB, a `.exe` renamed to `.pdf`, an HTML file sent with `image/png`, and a request with no file are each rejected with `400` and a clear message, and the status does not change.
- [ ] A doctor with status `pending` or `approved` who uploads again gets `409`. A doctor with `rejected` can upload again, the status returns to `pending`, the rejection reason is cleared and the old file is deleted.
- [ ] A Doctor, a Disabled User and an unauthenticated caller each get `403` or `401` on every `/api/admin/` endpoint. An Admin gets `200`.
- [ ] An Admin can list pending records oldest first, open a document, approve one, and reject another with a reason. A reject without a reason, or with a reason over 500 characters, returns `400`.
- [ ] Approving or rejecting an already approved or rejected record returns `409`, and the first decision's admin and time are unchanged.
- [ ] A doctor with status `not_submitted`, `pending` or `rejected` gets `403` with code `verification_required` on patients, alerts, acknowledge, appointments, appointment status and messages, and `200` on `/api/me/` and `/api/me/verification/`.
- [ ] After approval, the same doctor gets `200` on those endpoints.
- [ ] `GET /api/doctors/` returns only approved doctors. Registering a Disabled User with an unapproved doctor fails with an error on `registered_doctor_username`.
- [ ] Revoking an approved doctor clears `registered_doctor` for all of that doctor's patients, and their next alert is saved without a doctor.
- [ ] One doctor cannot read, replace or review another doctor's document. A doctor cannot call the admin endpoints.
- [ ] After the migration, every doctor that existed before is `approved` and every other user has no verification record.
- [ ] `python manage.py create_admin <username>` creates a user with role `admin` after prompting for a password, and refuses a username that already exists.
- [ ] A request to register with `role: "admin"` is rejected.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Django backend: `accounts` | Modified / New | Role, verification model, endpoints, permissions, admin command, doctor list |
| Django backend: `alerts` | Modified | Doctor-must-be-approved checks and routing |
| Django backend: `appointments` | Modified | Doctor endpoints require an approved doctor |
| Django backend: `messaging` | Modified | Doctor side requires an approved doctor |
| Django backend: `dikonekti` (settings, urls) | Modified | Required private storage directory setting |
| Next.js web, Flutter app | None | Handled in DIK-004, DIK-005, DIK-006 |

### DB / Migration
- `accounts/migrations/0003_doctor_verification.py` (reserved here): adds the `admin` choice to `User.role` and creates `DoctorVerification` (one-to-one with the user, status, document file, submitted time, rejection reason, reviewing admin, reviewed time).
- `accounts/migrations/0004_approve_existing_doctors.py` (reserved here, separate so it can be reviewed and reversed independently): creates an `approved` record for every existing doctor.
- The next free `accounts` migration after this ticket is `0005`.

### API Contract
| Endpoint | Who | Notes |
|---|---|---|
| `GET /api/me/` | any | adds `verification_status` |
| `GET`, `POST /api/me/verification/` | doctor | status, upload (multipart `document`) |
| `GET /api/admin/verifications/?status=` | admin | list |
| `GET /api/admin/verifications/<id>/document/` | admin | streams the file |
| `POST /api/admin/verifications/<id>/approve/` | admin | |
| `POST /api/admin/verifications/<id>/reject/` | admin | `{reason}` |
| `GET /api/doctors/` | public | approved doctors only |
| `POST /api/auth/register/` | public | doctor must be approved to be selected |

All doctor endpoints other than the two `me` ones return `403` with `code: "verification_required"` until approval.

### Key Implementation Notes
- **A separate `DoctorVerification` model, not columns on `User`.** `User` already holds nullable fields for both roles; adding more would mix three roles' data. A separate table keeps review data (who, when, why) together and allows a history table later.
- **Enforce on the server, with one permission class.** Add `IsAdmin` and `IsVerifiedDoctor` in `accounts/permissions.py`. Use `IsVerifiedDoctor` on every doctor-side view instead of repeating checks. The permission carries the `verification_required` code. Before widening or narrowing any doctor permission, grep for `IsDoctor`, `role == 'doctor'` and `user.role` in all four apps, because several views (alerts list, appointments, messages) authorize by role inside `get_queryset` rather than through a permission class.
- **Private storage.** A required `DJANGO_MEDIA_ROOT` setting (same start-up check as DIK-002) points to a directory outside any served path. No URL route serves it. Files are named with random UUIDs, never with the uploaded name.
- **Content check by magic bytes**: `%PDF-`, `\x89PNG\r\n\x1a\n` and `\xff\xd8\xff`. No image library is added. Rejected alternative: trusting the extension or `Content-Type`, which an attacker controls.
- **Serving the document to admins.** Rejected alternative: a signed public URL, which can be forwarded to someone who is not an admin. Streaming through an authenticated endpoint costs one request per view, which is fine at this volume.
- **Revocation clears patients' doctors** so alerts are never saved against a doctor who cannot see them. The cost is that patients must pick a doctor again.
- Rejected alternative for the first admin: only Django `createsuperuser`. That creates a Django staff user, not an app user with role `admin`, which cannot log in to the web review screen.
- Antivirus scanning of uploads (for example ClamAV) is not included; it needs infrastructure. Admins view documents in the browser, which is why the sandbox header is set.

---

## Out of Scope

- The doctor verification screens on web and mobile (DIK-004, DIK-005) and the admin review screen (DIK-006).
- Emails or push notifications about decisions.
- Checking a certificate against an external licensing registry.
- Keeping a history of past submissions, or re-verification on a schedule.
- Antivirus scanning, encryption at rest and object storage (S3). Local private storage is used for now.
- Verification of Disabled Users.

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `Dikonekt_Backend/dikonekti/accounts/models.py` | Modified (`Role.ADMIN`, `DoctorVerification`) |
| `Dikonekt_Backend/dikonekti/accounts/migrations/0003_doctor_verification.py` | New |
| `Dikonekt_Backend/dikonekti/accounts/migrations/0004_approve_existing_doctors.py` | New |
| `Dikonekt_Backend/dikonekti/accounts/permissions.py` | Modified (`IsAdmin`, `IsVerifiedDoctor`) |
| `Dikonekt_Backend/dikonekti/accounts/serializers.py` | Modified (profile `verification_status`, register validation, verification serializers) |
| `Dikonekt_Backend/dikonekti/accounts/verification_views.py` | New (doctor upload and status, admin list, document, approve, reject) |
| `Dikonekt_Backend/dikonekti/accounts/files.py` | New (type check, size check, private storage, deletion) |
| `Dikonekt_Backend/dikonekti/accounts/urls.py` | Modified |
| `Dikonekt_Backend/dikonekti/accounts/views.py` | Modified (`DoctorListView` approved only, `PatientListView` permission) |
| `Dikonekt_Backend/dikonekti/accounts/admin.py` | Modified (register `DoctorVerification`, `admin` role in the user form) |
| `Dikonekt_Backend/dikonekti/accounts/management/commands/create_admin.py` | New |
| `Dikonekt_Backend/dikonekti/alerts/views.py`, `alerts/serializers.py`, `alerts/permissions.py` | Modified |
| `Dikonekt_Backend/dikonekti/appointments/views.py`, `appointments/permissions.py` | Modified |
| `Dikonekt_Backend/dikonekti/messaging/views.py`, `messaging/serializers.py` | Modified |
| `Dikonekt_Backend/dikonekti/dikonekti/settings.py` | Modified (`DJANGO_MEDIA_ROOT`) |
| `Dikonekt_Backend/dikonekti/accounts/tests.py`, `alerts/tests.py`, `appointments/tests.py`, `messaging/tests.py` | Modified |
