"""Rate limits for the two public, unauthenticated endpoints.

Login is limited per *username*, not per IP: the Next.js app calls Django from its own
server, so every web user shares one IP, and an attacker rotating IPs would otherwise
still be free to guess against a single account. Registration has no username to key on
yet, so it is limited per client IP. Rates live in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
import contextlib
import hashlib
import logging
import os
import threading
import time

from django.conf import settings
from rest_framework.exceptions import ParseError
from rest_framework.throttling import SimpleRateThrottle

try:
    import fcntl  # POSIX only; on other systems the in-process lock below is all there is
except ImportError:  # pragma: no cover
    fcntl = None

_THREAD_LOCK = threading.Lock()

# How long a request waits for the limiter's lock before giving up. A stuck lock must never
# stall every login, so after this the request is let through and an error is logged.
LOCK_TIMEOUT_SECONDS = 2.0
_RETRY_SECONDS = 0.01

logger = logging.getLogger(__name__)


def _lock_file_path():
    """A lock file next to the cache files, when the cache is file based (shared by worker processes)."""
    cache = settings.CACHES.get('default', {})
    if cache.get('BACKEND', '').endswith('FileBasedCache') and cache.get('LOCATION'):
        return os.path.join(cache['LOCATION'], '.throttle.lock')
    return None


@contextlib.contextmanager
def _serialized():
    """Make the throttle's read-modify-write of its counter atomic. Yields whether the lock is held.

    DRF reads the request history, decides, then writes it back, so simultaneous requests
    all see the same old history and all get through. A thread lock stops that inside one
    process and an exclusive file lock stops it across worker processes on one host.
    Waiting is bounded by LOCK_TIMEOUT_SECONDS: yields False if the lock could not be taken.
    """
    deadline = time.monotonic() + LOCK_TIMEOUT_SECONDS
    if not _THREAD_LOCK.acquire(timeout=LOCK_TIMEOUT_SECONDS):
        yield False
        return
    try:
        path = _lock_file_path()
        if fcntl is None or path is None:
            yield True
            return
        os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
        handle = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            # flock has no timeout of its own, so try without blocking until the deadline.
            while True:
                try:
                    fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        yield False
                        return
                    time.sleep(_RETRY_SECONDS)
            yield True
        finally:
            os.close(handle)  # closing the descriptor also releases the lock
    finally:
        _THREAD_LOCK.release()


class _Serialized:
    """Run the limit check under the lock, and never let the limiter itself stop a login.

    If the lock cannot be taken in time, or the limiter hits a file error (disk full, folder
    permissions changed, locks unsupported), the request is let through and the problem is
    logged: logins keep working, but are not rate limited until it is fixed. Once it has
    failed for a request, the request's other throttles skip the check instead of waiting
    for the same problem again.
    """

    def allow_request(self, request, view):
        if getattr(request, '_rate_limiter_failed', False):
            return True
        try:
            with _serialized() as held:
                if held:
                    return super().allow_request(request, view)
                logger.error(
                    'Could not take the rate-limit lock within %s seconds; letting the request '
                    'through unchecked (scope=%s). Check the throttle cache folder.',
                    LOCK_TIMEOUT_SECONDS, self.scope,
                )
        except OSError:
            logger.exception(
                'The rate limiter failed with a file error; letting the request through '
                'unchecked (scope=%s). Check the throttle cache folder.', self.scope,
            )
        request._rate_limiter_failed = True
        return True


def _normalized_username(request):
    """The username being tried (trimmed, lower-cased), or None when there is nothing to key on."""
    try:
        data = request.data
    except ParseError:
        return None  # an unreadable body is rejected by the view itself
    if not hasattr(data, 'get'):
        return None
    username = data.get('username')
    if not isinstance(username, str):
        return None
    return username.strip().lower() or None


class _LoginThrottle(_Serialized, SimpleRateThrottle):
    def get_cache_key(self, request, view):
        username = _normalized_username(request)
        if username is None:
            return None
        # Hashed so usernames never appear in cache keys and keys stay short and safe.
        ident = hashlib.sha256(username.encode()).hexdigest()
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class LoginMinuteThrottle(_LoginThrottle):
    scope = 'login_minute'

    def allow_request(self, request, view):
        allowed = super().allow_request(request, view)
        if not allowed:
            request._login_minute_refused = True  # read by LoginHourThrottle
        return allowed


class LoginHourThrottle(_LoginThrottle):
    scope = 'login_hour'

    def allow_request(self, request, view):
        # DRF asks every throttle even after another one refused the request. A request the
        # minute limit already turned away never reached a password check, so it must not use
        # up the hourly allowance, or a locked-out user pressing Log in locks themselves out
        # for the whole hour.
        if getattr(request, '_login_minute_refused', False):
            return True
        return super().allow_request(request, view)


class RegisterThrottle(_Serialized, SimpleRateThrottle):
    scope = 'register'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}
