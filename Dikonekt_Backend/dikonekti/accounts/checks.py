"""System check: the rate-limit cache folder must be usable.

Without it, every login and registration would fail with a 500 at the first request. Running
as a Django system check makes the server refuse to start, naming the setting to fix.
"""
import os
import stat
import tempfile

from django.conf import settings
from django.core.checks import Error, register


@register()
def check_throttle_cache(app_configs, **kwargs):
    cache = settings.CACHES.get('default', {})
    if not cache.get('BACKEND', '').endswith('FileBasedCache'):
        return []
    folder = cache.get('LOCATION')
    try:
        os.makedirs(folder, mode=0o700, exist_ok=True)
        with tempfile.TemporaryFile(dir=folder):
            pass
        problem = _privacy_problem(folder)
        if problem:
            return [Error(
                f'The rate-limit cache folder {folder} {problem}. Anyone who can change it can reset '
                'the login and registration limits. '
                'Set DJANGO_CACHE_DIR to a folder owned by the user running the server (chmod 700).',
                id='accounts.E002',
            )]
    except OSError as error:
        return [Error(
            f'The rate-limit cache folder {folder} is not usable ({error.strerror}). '
            'Login and registration cannot work without it. '
            'Set DJANGO_CACHE_DIR to a folder the server can create and write to.',
            id='accounts.E001',
        )]
    return []


def _privacy_problem(folder):
    """Why the folder is not safe to keep rate-limit counters in, or None.

    The default name is predictable and lives in the shared temp directory, so another local
    user could have created it first. It must belong to the running user and must not be
    writable by anyone else.
    """
    info = os.stat(folder)
    if hasattr(os, 'getuid') and info.st_uid != os.getuid():
        return 'is owned by another user (it must be owned by the user running the server)'
    if info.st_mode & 0o022:
        return f'is writable by other users (mode {stat.S_IMODE(info.st_mode):o})'
    return None
