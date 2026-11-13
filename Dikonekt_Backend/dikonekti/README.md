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

Optional: `DJANGO_DEBUG` (off unless `true`), `DJANGO_DB_HOST` (`localhost`), `DJANGO_DB_PORT` (`5432`),
`CORS_ALLOWED_ORIGINS` (none), `DJANGO_CACHE_DIR`, `DJANGO_NUM_PROXIES` (0).

## Tests

The tests use the same environment variables and create their own temporary `test_` database,
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
- Behind the Next.js server every web login arrives from one IP, which is why login is limited by username, not IP.
- The client address comes from the connection itself. `X-Forwarded-For` is ignored unless `DJANGO_NUM_PROXIES` says how many trusted proxies sit in front of Django, so a client cannot fake its address to get a fresh registration allowance.
