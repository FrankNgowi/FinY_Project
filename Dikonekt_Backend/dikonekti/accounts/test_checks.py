import os
import stat
import tempfile
from pathlib import Path
from unittest import mock, skipIf

from django.test import SimpleTestCase, override_settings

from accounts.checks import check_throttle_cache
from accounts.throttles import LoginMinuteThrottle
from accounts.test_throttling import fake_request, file_cache


class ThrottleCacheCheckTests(SimpleTestCase):
    def test_a_writable_folder_passes(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            self.assertEqual(check_throttle_cache(None), [])

    def test_a_missing_folder_is_created_privately_and_passes(self):
        with tempfile.TemporaryDirectory() as parent:
            folder = Path(parent) / "new" / "throttle"
            with override_settings(CACHES=file_cache(folder)):
                self.assertEqual(check_throttle_cache(None), [])
            self.assertTrue(folder.is_dir())
            self.assertEqual(stat.S_IMODE(folder.stat().st_mode), 0o700)

    @skipIf(os.geteuid() == 0, "root can write anywhere, so a read-only folder proves nothing")
    def test_an_unwritable_folder_is_reported_naming_the_setting(self):
        with tempfile.TemporaryDirectory() as parent:
            folder = Path(parent) / "locked"
            folder.mkdir(mode=0o500)
            with override_settings(CACHES=file_cache(folder)):
                errors = check_throttle_cache(None)
            self.assertEqual(len(errors), 1)
            self.assertIn("DJANGO_CACHE_DIR", errors[0].msg)
            self.assertIn(str(folder), errors[0].msg)
            self.assertNotIn("password", errors[0].msg.lower())

    @skipIf(os.geteuid() == 0, "root can write anywhere")
    def test_a_folder_that_cannot_even_be_created_is_reported(self):
        with tempfile.TemporaryDirectory() as parent:
            locked = Path(parent) / "locked"
            locked.mkdir(mode=0o500)
            with override_settings(CACHES=file_cache(locked / "inside")):
                self.assertEqual(len(check_throttle_cache(None)), 1)

    def test_a_folder_that_other_users_can_write_to_is_reported(self):
        for mode in (0o777, 0o770, 0o757, 0o722):
            with tempfile.TemporaryDirectory() as parent:
                folder = Path(parent) / "shared"
                folder.mkdir()
                folder.chmod(mode)
                with override_settings(CACHES=file_cache(folder)):
                    errors = check_throttle_cache(None)
                self.assertEqual(len(errors), 1, oct(mode))
                self.assertIn("DJANGO_CACHE_DIR", errors[0].msg)
                self.assertIn("writable", errors[0].msg)

    def test_a_folder_others_can_only_read_or_not_touch_is_accepted(self):
        for mode in (0o700, 0o750, 0o755):
            with tempfile.TemporaryDirectory() as parent:
                folder = Path(parent) / "ok"
                folder.mkdir()
                folder.chmod(mode)
                with override_settings(CACHES=file_cache(folder)):
                    self.assertEqual(check_throttle_cache(None), [], oct(mode))

    def test_a_folder_owned_by_someone_else_is_reported(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            with mock.patch("os.getuid", return_value=os.stat(folder).st_uid + 1, create=True):
                errors = check_throttle_cache(None)
        self.assertEqual(len(errors), 1)
        self.assertIn("owned by", errors[0].msg)
        self.assertIn("DJANGO_CACHE_DIR", errors[0].msg)

    def test_other_cache_backends_are_not_checked(self):
        caches = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "x"}}
        with override_settings(CACHES=caches):
            self.assertEqual(check_throttle_cache(None), [])

    def test_the_check_is_part_of_the_projects_system_checks(self):
        from django.core.checks import registry
        self.assertIn(check_throttle_cache, registry.registry.registered_checks)


class LockFileTests(SimpleTestCase):
    def test_the_lock_file_is_private_to_the_owner(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            LoginMinuteThrottle().allow_request(fake_request("perm"), None)
            self.assertEqual(stat.S_IMODE((Path(folder) / ".throttle.lock").stat().st_mode), 0o600)
