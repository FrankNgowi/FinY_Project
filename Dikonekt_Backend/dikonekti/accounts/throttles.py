"""Rate limits for the two public, unauthenticated endpoints.

Login is limited per *username*, not per IP: the Next.js app calls Django from its own
server, so every web user shares one IP, and an attacker rotating IPs would otherwise
still be free to guess against a single account. Registration has no username to key on
yet, so it is limited per client IP. Rates live in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
import contextlib
import hashlib
import os
import threading

from django.conf import settings
from rest_framework.exceptions import ParseError
from rest_framework.throttling import SimpleRateThrottle

try:
    import fcntl  # POSIX only; on other systems the in-process lock below is all there is
except ImportError:  # pragma: no cover
    fcntl = None

_THREAD_LOCK = threading.Lock()


def _lock_file_path():
    """A lock file next to the cache files, when the cache is file based (shared by worker processes)."""
    cache = settings.CACHES.get('default', {})
    if cache.get('BACKEND', '').endswith('FileBasedCache') and cache.get('LOCATION'):
        return os.path.join(cache['LOCATION'], '.throttle.lock')
    return None


@contextlib.contextmanager
def _serialized():
    """Make the throttle's read-modify-write of its counter atomic.

    DRF reads the request history, decides, then writes it back, so simultaneous requests
    all see the same old history and all get through. A thread lock stops that inside one
    process and an exclusive file lock stops it across worker processes on one host.
    """
    with _THREAD_LOCK:
        path = _lock_file_path()
        if fcntl is None or path is None:
            yield
            return
        os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
        handle = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            fcntl.flock(handle, fcntl.LOCK_EX)
            yield
        finally:
            os.close(handle)  # closing the descriptor also releases the lock


class _Serialized:
    def allow_request(self, request, view):
        with _serialized():
            return super().allow_request(request, view)


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


class LoginHourThrottle(_LoginThrottle):
    scope = 'login_hour'


class RegisterThrottle(_Serialized, SimpleRateThrottle):
    scope = 'register'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}
