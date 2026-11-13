# Dikonekti backend

Django REST API for the Dikonekti mobile app and the `dikonekti-web` dashboard.

## Run it locally

```bash
cd Dikonekt_Backend/dikonekti
python3 -m venv .venv && . .venv/bin/activate
pip install -r dikonekti/requirements.txt

cp .env.example .env           # then fill in DJANGO_SECRET_KEY and DJANGO_DB_PASSWORD
set -a; . ./.env; set +a       # load it into this terminal (repeat in every new terminal)

python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Postgres must be running and the database named in `DJANGO_DB_NAME` must exist.

## Configuration

Everything environment-specific comes from environment variables (see `.env.example`).
These are required and have no default. The server stops at start-up and names the one that is missing:

| Variable | What it is |
|---|---|
| `DJANGO_SECRET_KEY` | Django's signing key. Changing it signs every user out |
| `DJANGO_DB_NAME`, `DJANGO_DB_USER`, `DJANGO_DB_PASSWORD` | Postgres connection |
| `DJANGO_ALLOWED_HOSTS` | Required when `DJANGO_DEBUG` is off |
| `DJANGO_MEDIA_ROOT` | Folder for doctors' uploaded certificates. Required when `DJANGO_DEBUG` is off; with debug on it defaults to `.private-media/` |

Optional: `DJANGO_DEBUG` (off unless `true`), `DJANGO_DB_HOST` (`localhost`), `DJANGO_DB_PORT` (`5432`),
`CORS_ALLOWED_ORIGINS` (none), `DJANGO_CACHE_DIR`, `DJANGO_NUM_PROXIES` (0).

## Tests

The tests use the same environment variables (including `DJANGO_MEDIA_ROOT` unless `DJANGO_DEBUG=true`) and create their own temporary `test_` database,
so the database user needs permission to create databases.

```bash
python manage.py test
```

## Limits and rate limiting

- A message is at most 2,000 characters.
- Login is limited per username (5 per minute, 30 per hour) and registration per client IP (5 per hour).
  Over the limit the API answers `429` with a `Retry-After` header.
- Rate-limit counters are kept in a file-based cache shared by all worker processes on one host.
  Running on several hosts needs a shared cache such as Redis.
- The rate-limit folder must belong to the user running the server and must not be writable by anyone else (the server refuses to start otherwise), because anyone who can change it can reset the limits.
- If the limiter cannot take its lock within 2 seconds, or hits a file error (for example a full disk), the request is let through and an error is logged, so logins keep working but are not rate limited until it is fixed. Watch the log for "Could not take the rate-limit lock".
- Behind the Next.js server every web login arrives from one IP, which is why login is limited by username, not IP.
- The client address comes from the connection itself. `X-Forwarded-For` is ignored unless `DJANGO_NUM_PROXIES` says how many trusted proxies sit in front of Django, so a client cannot fake its address to get a fresh registration allowance.

## Doctor verification and the admin role

A doctor cannot see patients, alerts, appointments or messages until an admin approves their
confirmation letter or certificate. Until then the API answers those endpoints with `403` and
`{"code": "verification_required"}`; the doctor can still log in, read `/api/me/` and use
`/api/me/verification/` to upload the document (PDF, JPEG or PNG, up to 5 MB).

- Create the first admin (and any other) on the server. The password is asked for, never passed on the command line:

  ```bash
  python manage.py create_admin <username>
  ```

- Admins use the same login as everyone else. They review through `/api/admin/verifications/`
  (list, view the document, approve, reject with a reason). Rejecting an approved doctor revokes
  them and removes them from their patients' accounts, so the patients must choose a doctor again.
- Doctors who already existed when this feature was added are approved by a migration.
- Certificates are stored in `DJANGO_MEDIA_ROOT` under random names and are only served to a signed-in admin.
  Back this folder up together with the database.
- Uploads are limited to 10 per doctor per hour (`429`), and a request declaring more than 6 MB is refused (`413`) before it is read.
  A refused `413` request still counts toward the hourly limit.
- Antivirus scanning and object storage (S3) are not included. The files live on one host.
