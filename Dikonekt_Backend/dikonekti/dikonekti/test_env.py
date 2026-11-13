import os
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from dikonekti.env import allowed_hosts, env_bool, env_int, env_list, env_required


class EnvBoolTests(SimpleTestCase):
    def test_unset_uses_the_default(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(env_bool("X"))
            self.assertTrue(env_bool("X", default=True))

    def test_truthy_words_are_true_in_any_case(self):
        for value in ("1", "true", "TRUE", "Yes", "on", " On "):
            with mock.patch.dict(os.environ, {"X": value}):
                self.assertTrue(env_bool("X"), value)

    def test_everything_else_is_false(self):
        for value in ("0", "false", "no", "off", "", "  ", "enabled", "2"):
            with mock.patch.dict(os.environ, {"X": value}):
                self.assertFalse(env_bool("X", default=True), value)


class EnvListTests(SimpleTestCase):
    def test_splits_trims_and_drops_empty_items(self):
        with mock.patch.dict(os.environ, {"X": "a, b ,,c"}):
            self.assertEqual(env_list("X"), ["a", "b", "c"])

    def test_unset_blank_and_only_commas_give_an_empty_list(self):
        for value in (None, "", "   ", " , ,"):
            env = {} if value is None else {"X": value}
            with mock.patch.dict(os.environ, env, clear=True):
                self.assertEqual(env_list("X"), [], value)


class EnvRequiredTests(SimpleTestCase):
    def test_returns_the_value_unchanged(self):
        with mock.patch.dict(os.environ, {"X": " keep spaces "}):
            self.assertEqual(env_required("X"), " keep spaces ")

    def test_unset_blank_and_whitespace_raise_naming_the_variable(self):
        for value in (None, "", "   "):
            env = {} if value is None else {"DJANGO_THING": value}
            with mock.patch.dict(os.environ, env, clear=True):
                with self.assertRaises(ImproperlyConfigured) as ctx:
                    env_required("DJANGO_THING")
                self.assertIn("DJANGO_THING", str(ctx.exception))

    def test_the_error_never_contains_other_values(self):
        with mock.patch.dict(os.environ, {"OTHER": "super-secret"}, clear=True):
            with self.assertRaises(ImproperlyConfigured) as ctx:
                env_required("DJANGO_THING")
            self.assertNotIn("super-secret", str(ctx.exception))


class AllowedHostsTests(SimpleTestCase):
    def test_a_configured_list_is_returned_as_given(self):
        self.assertEqual(allowed_hosts(False, "api.example.test, www.example.test"), ["api.example.test", "www.example.test"])
        self.assertEqual(allowed_hosts(True, "api.example.test"), ["api.example.test"])

    def test_debug_off_without_hosts_raises_naming_the_variable(self):
        for raw in (None, "", "  ", " , "):
            with self.assertRaises(ImproperlyConfigured) as ctx:
                allowed_hosts(False, raw)
            self.assertIn("DJANGO_ALLOWED_HOSTS", str(ctx.exception))

    def test_debug_on_without_hosts_defaults_to_localhost_only(self):
        for raw in (None, ""):
            self.assertEqual(allowed_hosts(True, raw), ["localhost", "127.0.0.1"])

    def test_a_wildcard_is_only_ever_an_explicit_choice(self):
        self.assertEqual(allowed_hosts(False, "*"), ["*"])
        self.assertNotIn("*", allowed_hosts(True, None))


class EnvIntTests(SimpleTestCase):
    def test_unset_and_blank_use_the_default(self):
        for value in (None, "", "  "):
            env = {} if value is None else {"X": value}
            with mock.patch.dict(os.environ, env, clear=True):
                self.assertEqual(env_int("X", 0), 0)

    def test_a_whole_number_is_parsed(self):
        with mock.patch.dict(os.environ, {"X": " 2 "}):
            self.assertEqual(env_int("X", 0), 2)

    def test_anything_else_stops_start_up_naming_the_variable(self):
        for value in ("abc", "1.5", "-1", "1e3", "0x10"):
            with mock.patch.dict(os.environ, {"DJANGO_NUM_PROXIES": value}):
                with self.assertRaises(ImproperlyConfigured) as ctx:
                    env_int("DJANGO_NUM_PROXIES", 0)
                self.assertIn("DJANGO_NUM_PROXIES", str(ctx.exception), value)
