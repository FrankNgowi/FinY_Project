"""System check: the rate-limit cache folder must be usable.

Without it, every login and registration would fail with a 500 at the first request. Running
as a Django system check makes the server refuse to start, naming the setting to fix.
"""
import os
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
    except OSError as error:
        return [Error(
            f'The rate-limit cache folder {folder} is not usable ({error.strerror}). '
            'Login and registration cannot work without it. '
            'Set DJANGO_CACHE_DIR to a folder the server can create and write to.',
            id='accounts.E001',
        )]
    return []
