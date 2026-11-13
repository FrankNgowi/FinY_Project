"""Small helpers for reading configuration from environment variables.

Kept free of Django settings so the rules can be unit tested and so the start-up
error always names the variable that is missing, never a secret value.
"""
import os

from django.core.exceptions import ImproperlyConfigured

_TRUE_WORDS = {"1", "true", "yes", "on"}
LOCAL_HOSTS = ["localhost", "127.0.0.1"]


def env_bool(name, default=False):
    """True for 1/true/yes/on (any case); any other set value is False; unset uses `default`."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUE_WORDS


def env_list(name):
    """A comma-separated variable as a list, trimmed, with empty items dropped."""
    return _split(os.environ.get(name))


def env_int(name, default):
    """A non-negative whole number. Unset or blank uses `default`; anything else stops start-up."""
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    value = raw.strip()
    if not value.isdigit():
        raise ImproperlyConfigured(f"The environment variable {name} must be a whole number (0 or more).")
    return int(value)


def env_required(name):
    """The variable's value. Unset or blank stops start-up, naming the variable."""
    value = os.environ.get(name)
    if value is None or not value.strip():
        raise ImproperlyConfigured(f"The environment variable {name} must be set.")
    return value


def allowed_hosts(debug, raw):
    """ALLOWED_HOSTS from the DJANGO_ALLOWED_HOSTS value.

    With debug on and nothing set, only localhost is allowed. With debug off, a list
    is required: there is no default, and "*" is accepted only if written explicitly.
    """
    hosts = _split(raw)
    if hosts:
        return hosts
    if debug:
        return list(LOCAL_HOSTS)
    raise ImproperlyConfigured("The environment variable DJANGO_ALLOWED_HOSTS must list the allowed hosts when DJANGO_DEBUG is off.")


def _split(raw):
    return [item.strip() for item in (raw or "").split(",") if item.strip()]
