# Project context

## Module map

| Directory | What it is |
|---|---|
| `dikonekti/` | Flutter app (mobile). Contains a Flutter `web/` target that is not used for the web dashboard. |
| `Dikonekt_Backend/dikonekti/` | Django REST API (`accounts`, `alerts`, `appointments`, `messaging`). |
| `dikonekti-web/` | Next.js doctor dashboard (DIK-001). Named `dikonekti-web` so it cannot be confused with Flutter's `dikonekti/web/`. |

Duplicate nested folders `dikonekti/dikonekti` and `dikonekti/Dikonekt_Backend` exist in the repo. Do not use them (DIK-009 removes them). The real backend is `Dikonekt_Backend/dikonekti/`, where `manage.py` lives.

## Tickets and specs

- Tickets: `.ai/tickets/DIK-NNN-*.md`. Next number is the highest on disk + 1.
- Implementation specs: `.ai/specs/DIK-NNN.md`.

## Reserved migration numbers

| App | Reserved | By | Next free after it |
|---|---|---|---|
| `messaging` | `0002_message_body_max_length` (applied, shipped with DIK-002) | DIK-002 | `0003` |
| `accounts` | `0003_doctor_verification`, `0004_approve_existing_doctors` (shipped with DIK-003) | DIK-003 | `0005` |

## Planned follow-ups to DIK-001

Build order: DIK-002 (backend hardening) then DIK-003 (doctor verification backend and admin role). After DIK-003: DIK-004 (web doctor verification) and DIK-005 (Flutter doctor verification) in parallel, then DIK-006 (admin review on web, needs DIK-004). DIK-007 (patient dashboard on web) and DIK-008 (launcher icon) are independent. DIK-004, DIK-006 and DIK-007 each add a separate case to `decideRoute` in `dikonekti-web/src/lib/route-gate.ts`, so the second and third to land must rebase.

## Backend: doctor verification (DIK-003)

- Roles are `doctor`, `disabled` and `admin`. `DoctorVerification` (in `accounts/models.py`) holds a doctor's status and does all status changes (`submit`, `approve`, `reject`), each under a row lock. Views only call it.
- Permissions are in `accounts/permissions.py`: `IsAdmin`, `IsVerifiedDoctor` (answers `403` with `code: "verification_required"`), `IsDisabledOrVerifiedDoctor` (shared list endpoints). Route alerts, appointments and messages through `User.approved_registered_doctor`, never `registered_doctor`.
- File rules (type check from the first bytes, 5 MB, private storage, delete after commit) are all in `accounts/files.py`. Certificates are stored in `DJANGO_MEDIA_ROOT` (required unless debug; checked at start-up by `accounts.E003`).
- Create an admin with `python manage.py create_admin <username>`.

## Running the backend

`Dikonekt_Backend/dikonekti/README.md` explains how to run and test it. The server needs `DJANGO_SECRET_KEY`, `DJANGO_DB_NAME`, `DJANGO_DB_USER` and `DJANGO_DB_PASSWORD` in the environment (and `DJANGO_ALLOWED_HOSTS` and `DJANGO_MEDIA_ROOT` unless `DJANGO_DEBUG=true`); without them it stops at start-up and names the missing one. Copy `.env.example` and load it with `set -a; . ./.env; set +a`.
