# DIK-002: Harden the Django backend for deployment

**Type:** Chore
**Priority:** High
**Platform:** Django backend (`Dikonekt_Backend/dikonekti/`), plus one small change in the Next.js web app (`dikonekti-web/`) for the new rate-limit message
**Depends on:** None

---

## Problem Statement

The backend cannot be deployed safely or even started from a fresh checkout. `settings.py` has the Postgres password and the Django `SECRET_KEY` committed in plain text, `DEBUG = True`, `ALLOWED_HOSTS = ['*']` and `CORS_ALLOW_ALL_ORIGINS = True`. `requirements.txt` has no Postgres driver although the only configured database is Postgres. `Message.body` is an unlimited `TextField` (a 2 MB message is accepted), and login and register have no rate limiting, so passwords can be guessed without limit. This affects every Doctor and Disabled User and blocks any real hosting.

---

## User Stories

- As a **Doctor**, I want the server's secrets kept out of the code repository, so that leaked source code cannot be used to read my patients' data.
- As a **Disabled User**, I want repeated wrong-password attempts on my account to be blocked, so that nobody can guess my password.
- As a **Doctor**, I want messages limited in size, so that a conversation with a patient cannot be filled with huge messages that slow the app down.

---

## Approved Design / Behaviour

**Configuration comes from environment variables.** The server reads these at start-up:

| Variable | Rule |
|---|---|
| `DJANGO_SECRET_KEY` | Required. No default. |
| `DJANGO_DEBUG` | Optional, default off. `true` turns debug on. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated list. Required when debug is off. When debug is on and unset, defaults to `localhost,127.0.0.1`. |
| `DJANGO_DB_NAME`, `DJANGO_DB_USER`, `DJANGO_DB_PASSWORD` | Required. No defaults. |
| `DJANGO_DB_HOST`, `DJANGO_DB_PORT` | Optional, default `localhost` and `5432`. |
| `DJANGO_NUM_PROXIES` | Optional, default `0`. How many trusted reverse proxies sit in front of Django. At `0` the connection's own address is used and `X-Forwarded-For` is ignored. |
| `DJANGO_CACHE_DIR` | Optional. Folder for rate-limit counters. Default: a private per-user folder in the system temp directory. The server refuses to start if it cannot use the folder. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of origins. Default empty, which means no browser cross-origin access. `CORS_ALLOW_ALL_ORIGINS` is removed. |

A missing required variable stops the server with a clear message naming the variable. The Next.js web app calls Django from its own server and the mobile app is native, so neither needs CORS.

**Postgres driver.** `psycopg[binary]` is added to `requirements.txt`, so `pip install -r requirements.txt` produces a backend that can connect to the configured database.

**Message length.** A message body is at most 2,000 characters after trimming. A longer body returns `400` with `{"body": ["Message is too long (max 2000 characters)."]}`. The limit is also enforced by the database column.

**Rate limiting** (HTTP `429` with a `Retry-After` header):

| Endpoint | Limit | Keyed by |
|---|---|---|
| `POST /api/auth/login/` | 5 per minute and 30 per hour | the lower-cased username in the request |
| `POST /api/auth/register/` | 5 per hour | client IP address |

Token refresh and all other endpoints are not limited by this ticket.

**Web login message.** When Django answers `429`, the Next.js login and register routes pass the status through and the form shows "Too many attempts. Please wait a few minutes and try again." instead of the generic "unavailable" message. The mobile app already shows Django's message text.

---

## Acceptance Criteria

- [ ] A developer starting the server without `DJANGO_SECRET_KEY`, `DJANGO_DB_NAME`, `DJANGO_DB_USER` or `DJANGO_DB_PASSWORD` gets an error naming the missing variable and the server does not start.
- [ ] `settings.py` contains no secret key, no database password and no hard-coded host list. A search of the real backend (`Dikonekt_Backend/dikonekti/`) for the old values finds nothing; they remain only in git history and in the stale duplicate folder noted in the Scope note, which is removed by DIK-009.
- [ ] With `DJANGO_DEBUG` unset, `DEBUG` is false and a request with a `Host` header not in `DJANGO_ALLOWED_HOSTS` is rejected with `400`.
- [ ] With `CORS_ALLOWED_ORIGINS` unset, a browser preflight from any origin gets no `Access-Control-Allow-Origin` header. With one origin listed, only that origin is allowed.
- [ ] On a clean virtual environment, `pip install -r requirements.txt` followed by `python manage.py migrate` works against Postgres without installing anything else.
- [ ] A Doctor or Disabled User sending a message of 2,000 characters succeeds. One of 2,001 characters is rejected with `400` and the message above. A 2 MB body is rejected.
- [ ] The migration fails with a clear message, and changes nothing, if any existing message body is longer than 2,000 characters.
- [ ] The sixth login attempt for the same username within a minute returns `429` with `Retry-After`, even if the password is correct. A different username is not affected.
- [ ] The sixth registration from the same IP within an hour returns `429`.
- [ ] On the web login and register forms, a `429` shows the "Too many attempts" message, not a generic error.
- [ ] All existing backend and web tests pass, and new tests cover each rule above.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Django backend: `dikonekti` (settings, urls) | Modified | Environment-based settings, CORS, throttling configuration |
| Django backend: `accounts` | Modified | Throttle classes on login and register views |
| Django backend: `messaging` | Modified | Length limit on the model and serializer, new migration |
| Next.js web (`dikonekti-web/`) | Modified | Pass `429` through login and register routes and show the message |
| Flutter app (`dikonekti/`) | None | Already shows Django's error text |

### DB / Migration
`messaging/migrations/0002_message_body_max_length.py` changes `Message.body` from `TextField` to `CharField(max_length=2000)`. It first checks for rows over 2,000 characters and aborts with a message giving the count if any exist. This number is reserved here: the next free `messaging` migration is `0003`.

### API Contract
- `POST /api/messages/` returns `400` for a body over 2,000 characters.
- `POST /api/auth/login/` and `POST /api/auth/register/` can return `429` with `Retry-After` and `{"detail": "Request was throttled. Expected available in N seconds."}`.

### Key Implementation Notes
- **Throttle key for login is the username, not the IP.** Rejected alternative: limit by IP. Behind the Next.js server every web user shares one IP, so one attacker would lock out every web login, and an attacker rotating IPs would still guess freely against one account. The cost of the username key is that someone can deliberately lock a known username for a few minutes. That is accepted for now.
- **Register is limited by IP.** Behind the Next.js server all web registrations share one IP, so the limit is an aggregate cap there. Forwarding the real client IP from Next.js is out of scope (see below).
- **Secrets already in git history.** After this merges, the Postgres password must be changed and a new `DJANGO_SECRET_KEY` generated. Changing the secret key signs every user out because all issued tokens become invalid. This must be said in the PR description.
- Every developer must set the required variables locally. Provide `.env.example` and document it in a backend README; the server does not read a `.env` file itself, so developers export the variables or use their shell tooling.
- Rejected alternative for the message limit: a model validator without changing the column. It needs no migration, but admin or any other writer could still store long rows, so the limit would be only a request-level rule.

---

## Out of Scope

- Rewriting git history to remove the old secrets.
- Removing the stale duplicate backend under `dikonekti/Dikonekt_Backend/` (it still contains the old secret key); see DIK-009.
- Forwarding the real client IP from the Next.js server to Django. (By default Django ignores `X-Forwarded-For`; `DJANGO_NUM_PROXIES` exists for a deployment behind a trusted proxy.)
- A character counter or `maxLength` on the message inputs in the web and mobile apps.
- Rate limiting other endpoints (alerts, messages, appointments) or token refresh.
- HTTPS, secure-cookie and HSTS settings, which belong to the deployment ticket.
- Account lockout notifications by email.

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `Dikonekt_Backend/dikonekti/dikonekti/settings.py` | Modified (environment-based settings, CORS allowlist, throttle rates) |
| `Dikonekt_Backend/dikonekti/dikonekti/requirements.txt` | Modified (`psycopg[binary]`) |
| `Dikonekt_Backend/dikonekti/.env.example` | New |
| `Dikonekt_Backend/dikonekti/README.md` | New (run, required variables) |
| `Dikonekt_Backend/dikonekti/accounts/throttles.py` | New (username-keyed login throttle, IP-keyed register throttle) |
| `Dikonekt_Backend/dikonekti/accounts/views.py` | Modified (apply throttles to `LoginView` and `RegisterView`) |
| `Dikonekt_Backend/dikonekti/messaging/models.py` | Modified (`CharField(max_length=2000)`) |
| `Dikonekt_Backend/dikonekti/messaging/serializers.py` | Modified (length validation and message) |
| `Dikonekt_Backend/dikonekti/messaging/migrations/0002_message_body_max_length.py` | New |
| `Dikonekt_Backend/dikonekti/accounts/tests.py`, `messaging/tests.py` | Modified (throttle, length and settings tests) |
| `dikonekti-web/src/lib/auth/django-session.ts` | Modified (`429` as a rejected result with a message) |
| `dikonekti-web/src/app/api/auth/login/route.ts`, `register/route.ts` | Modified (pass the `429` status through) |
| `dikonekti-web/src/lib/auth/django-session.test.ts`, route tests | Modified |

---

## Scope note

- While implementing, a second, older copy of the backend was found at `dikonekti/Dikonekt_Backend/dikonekti/` (inside the Flutter folder, 41 tracked files including a `db.sqlite3`). Nothing references it, but it may be in use, so it is not changed here. The "no old secret in the repository" criterion was narrowed to the real backend, and removing the duplicate folders is DIK-009. After the secret key is rotated at deployment, the old key in that copy no longer protects anything.
- Tests live in named `test_*.py` modules next to the code (Django discovers them) instead of the empty `tests.py` stubs, and a backend `.gitignore` was added so a local `.env` and `.venv/` cannot be committed.
- QA against a running server found three defects in this change, fixed test-first: (1) a spoofed `X-Forwarded-For` header gave unlimited registrations, so Django now ignores that header unless `DJANGO_NUM_PROXIES` says a trusted proxy is in front; (2) simultaneous requests overshot the limits (15 to 19 of 25 got through a limit of 5), so each limit check now runs under a lock within a process and across worker processes on one host; (3) an unwritable rate-limit folder turned login and register into `500`s, so the default folder is now private per user and the server refuses to start with a clear error if the folder is unusable (`accounts/checks.py`).
- New files not in the original table: `accounts/checks.py`, `accounts/apps.py` (modified), `accounts/test_checks.py`, and `env_int` in `dikonekti/env.py`.
- Code review of the pull request (`/code-review-3`) found four more issues, fixed test-first: (1) requests the minute limit had already refused were also counted against the hourly limit, so a locked-out user pressing Log in repeatedly stayed locked out for the hour (now only requests that reach the password check count); (2) the default rate-limit folder name called `getpass.getuser()`, which crashes start-up in containers with a random user id (now falls back to the numeric id); (3) `DJANGO_NUM_PROXIES` accepted characters like `²` and then failed with a raw error (now only plain 0-9 digits, otherwise the usual message naming the variable); (4) the limiter's lock had no timeout, so a stuck lock could stall every login (now it waits at most 2 seconds, then lets the request through and logs an error, chosen over refusing with a 503 so that logins keep working).
- A second review pass found three more issues in the new limiter code, fixed test-first: (1) only a busy lock failed open, so other file errors in the limiter (disk full, folder permissions changed, locks unsupported) still turned login into a `500`; now any file error in the limiter lets the request through and logs it (other kinds of errors are not hidden); (2) the start-up check did not verify the folder is private, so a predictable `/tmp` name pre-created by another user would have passed; the check now also requires the folder to belong to the user running the server and not be writable by anyone else (`accounts.E002`); (3) each of the two login throttles waited for a stuck lock in turn, doubling the delay; a request now waits once.
