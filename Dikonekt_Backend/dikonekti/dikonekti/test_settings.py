import getpass
import json
import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parent.parent
SETTINGS_FILE = Path(__file__).resolve().parent / "settings.py"

BASE_ENV = {
    "DJANGO_SECRET_KEY": "test-secret-key",
    "DJANGO_DB_NAME": "db_name",
    "DJANGO_DB_USER": "db_user",
    "DJANGO_DB_PASSWORD": "db_password",
    "DJANGO_ALLOWED_HOSTS": "api.example.test",
    "DJANGO_MEDIA_ROOT": "/srv/dikonekti-certificates",
}
PROBE = (
    "import json, dikonekti.settings as s;"
    "print(json.dumps({"
    "'debug': s.DEBUG, 'secret': s.SECRET_KEY, 'hosts': s.ALLOWED_HOSTS,"
    "'db': s.DATABASES['default'], 'cors': s.CORS_ALLOWED_ORIGINS,"
    "'cors_all': getattr(s, 'CORS_ALLOW_ALL_ORIGINS', False),'num_proxies': s.REST_FRAMEWORK.get('NUM_PROXIES', 'unset'),'cache': s.CACHES['default'], 'media': s.MEDIA_ROOT, 'rates': s.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], 'file_perms': s.FILE_UPLOAD_PERMISSIONS, 'dir_perms': s.FILE_UPLOAD_DIRECTORY_PERMISSIONS}))"
)


def load_settings(remove=(), **overrides):
    """Import the settings module in a clean process with a controlled environment."""
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONDONTWRITEBYTECODE": "1", **BASE_ENV, **overrides}
    for name in remove:
        env.pop(name, None)
    return subprocess.run(
        [sys.executable, "-c", PROBE], cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60
    )


def loaded(result):
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


class RequiredVariableTests(SimpleTestCase):
    def test_each_required_variable_missing_stops_start_up_and_is_named(self):
        for name in ("DJANGO_SECRET_KEY", "DJANGO_DB_NAME", "DJANGO_DB_USER", "DJANGO_DB_PASSWORD"):
            result = load_settings(remove=[name])
            self.assertNotEqual(result.returncode, 0, name)
            self.assertIn(name, result.stderr)

    def test_blank_required_variables_are_treated_as_missing(self):
        result = load_settings(DJANGO_SECRET_KEY="   ")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_the_error_does_not_print_secret_values(self):
        result = load_settings(remove=["DJANGO_DB_NAME"])
        self.assertNotIn("db_password", result.stderr)
        self.assertNotIn("test-secret-key", result.stderr)


class DefaultsTests(SimpleTestCase):
    def test_debug_is_off_and_values_come_from_the_environment(self):
        data = loaded(load_settings())
        self.assertIs(data["debug"], False)
        self.assertEqual(data["secret"], "test-secret-key")
        self.assertEqual(data["hosts"], ["api.example.test"])
        self.assertEqual(data["db"]["NAME"], "db_name")
        self.assertEqual(data["db"]["USER"], "db_user")
        self.assertEqual(data["db"]["PASSWORD"], "db_password")

    def test_database_host_and_port_default_and_can_be_overridden(self):
        data = loaded(load_settings())
        self.assertEqual((data["db"]["HOST"], data["db"]["PORT"]), ("localhost", "5432"))
        data = loaded(load_settings(DJANGO_DB_HOST="db.internal", DJANGO_DB_PORT="6543"))
        self.assertEqual((data["db"]["HOST"], data["db"]["PORT"]), ("db.internal", "6543"))

    def test_debug_can_be_turned_on(self):
        self.assertIs(loaded(load_settings(DJANGO_DEBUG="true"))["debug"], True)

    def test_cors_defaults_to_no_origins_and_never_allows_all(self):
        data = loaded(load_settings())
        self.assertEqual(data["cors"], [])
        self.assertFalse(data["cors_all"])

    def test_cors_origins_come_from_the_environment(self):
        data = loaded(load_settings(CORS_ALLOWED_ORIGINS="https://a.example.test, https://b.example.test"))
        self.assertEqual(data["cors"], ["https://a.example.test", "https://b.example.test"])


class ProxyTrustTests(SimpleTestCase):
    def test_by_default_no_proxy_is_trusted_so_the_forwarded_header_is_ignored(self):
        self.assertEqual(loaded(load_settings())["num_proxies"], 0)

    def test_the_number_of_trusted_proxies_can_be_set(self):
        self.assertEqual(loaded(load_settings(DJANGO_NUM_PROXIES="1"))["num_proxies"], 1)

    def test_an_invalid_value_stops_start_up_naming_the_variable(self):
        result = load_settings(DJANGO_NUM_PROXIES="many")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_NUM_PROXIES", result.stderr)


class ThrottleCacheFolderTests(SimpleTestCase):
    def test_the_default_folder_is_private_to_the_running_user(self):
        cache = loaded(load_settings())["cache"]
        self.assertTrue(cache["BACKEND"].endswith("FileBasedCache"))
        # A name shared by every user of a machine could be pre-created by someone else.
        self.assertTrue(cache["LOCATION"].endswith(f"dikonekti-cache-{getpass.getuser()}"), cache["LOCATION"])

    def test_the_folder_can_be_set(self):
        self.assertEqual(loaded(load_settings(DJANGO_CACHE_DIR="/srv/dikonekti/throttle"))["cache"]["LOCATION"], "/srv/dikonekti/throttle")

    def test_a_blank_setting_falls_back_to_the_default(self):
        self.assertIn("dikonekti-cache-", loaded(load_settings(DJANGO_CACHE_DIR="  "))["cache"]["LOCATION"])


class AllowedHostsTests(SimpleTestCase):
    def test_debug_off_without_hosts_fails_naming_the_variable(self):
        result = load_settings(remove=["DJANGO_ALLOWED_HOSTS"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)

    def test_debug_on_without_hosts_defaults_to_localhost(self):
        data = loaded(load_settings(remove=["DJANGO_ALLOWED_HOSTS"], DJANGO_DEBUG="true"))
        self.assertEqual(data["hosts"], ["localhost", "127.0.0.1"])


class NoSecretsInSourceTests(SimpleTestCase):
    def test_settings_source_has_no_hard_coded_secret_key_password_or_wildcard_host(self):
        source = SETTINGS_FILE.read_text()
        self.assertNotIn("django-insecure-", source)
        self.assertNotIn("1234" + "5678", source)  # the old database password, split so this file does not contain it
        self.assertNotIn("ALLOWED_HOSTS = ['*']", source)
        self.assertNotIn("CORS_ALLOW_ALL_ORIGINS = True", source)


class MediaRootSettingTests(SimpleTestCase):
    def test_without_debug_a_missing_media_root_stops_start_up_and_is_named(self):
        result = load_settings(remove=["DJANGO_MEDIA_ROOT"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_MEDIA_ROOT", result.stderr)

    def test_without_debug_a_blank_media_root_counts_as_missing(self):
        result = load_settings(DJANGO_MEDIA_ROOT="   ")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_MEDIA_ROOT", result.stderr)

    def test_with_debug_it_defaults_to_a_private_folder_next_to_manage_py(self):
        settings = loaded(load_settings(DJANGO_DEBUG="true", remove=["DJANGO_MEDIA_ROOT", "DJANGO_ALLOWED_HOSTS"]))
        self.assertEqual(settings["media"], str(BACKEND_DIR / ".private-media"))

    def test_the_variable_wins_over_the_debug_default(self):
        settings = loaded(load_settings(DJANGO_DEBUG="true", DJANGO_MEDIA_ROOT="/srv/certs"))
        self.assertEqual(settings["media"], "/srv/certs")

    def test_upload_rate_is_ten_per_hour(self):
        settings = loaded(load_settings(DJANGO_MEDIA_ROOT="/srv/certs"))
        self.assertEqual(settings["rates"]["verification_upload"], "10/hour")

    def test_uploaded_files_and_folders_are_private_to_the_owner(self):
        settings = loaded(load_settings())
        self.assertEqual(settings["file_perms"], 0o600)
        self.assertEqual(settings["dir_perms"], 0o700)
