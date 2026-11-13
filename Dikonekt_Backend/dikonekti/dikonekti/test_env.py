import os
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from dikonekti.env import allowed_hosts, env_bool, env_int, env_list, env_required, private_folder_suffix


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
        # "²" and the Arabic-Indic "٣" pass str.isdigit() but are not plain 0-9 digits.
        for value in ("abc", "1.5", "-1", "1e3", "0x10", "²", "٣", "１"):
            with mock.patch.dict(os.environ, {"DJANGO_NUM_PROXIES": value}):
                with self.assertRaises(ImproperlyConfigured) as ctx:
                    env_int("DJANGO_NUM_PROXIES", 0)
                self.assertIn("DJANGO_NUM_PROXIES", str(ctx.exception), value)


class PrivateFolderSuffixTests(SimpleTestCase):
    """The default throttle cache folder is named after the running user, without ever failing start-up."""

    def test_it_is_the_user_name(self):
        with mock.patch("getpass.getuser", return_value="deploy"):
            self.assertEqual(private_folder_suffix(), "deploy")

    def test_characters_that_are_unsafe_in_a_path_are_replaced(self):
        with mock.patch("getpass.getuser", return_value="a/b\\..c d"):
            self.assertEqual(private_folder_suffix(), "a_b_..c_d")

    def test_a_user_id_with_no_name_falls_back_to_the_numeric_id(self):
        for error in (KeyError("getpwuid(): uid not found: 1234"), OSError("No username set"), ImportError("no pwd")):
            with mock.patch("getpass.getuser", side_effect=error), mock.patch("os.getuid", return_value=1234, create=True):
                self.assertEqual(private_folder_suffix(), "1234")

    def test_a_blank_name_falls_back_to_the_numeric_id(self):
        with mock.patch("getpass.getuser", return_value="  "), mock.patch("os.getuid", return_value=77, create=True):
            self.assertEqual(private_folder_suffix(), "77")

    def test_without_a_user_id_either_it_still_returns_something_usable(self):
        with mock.patch("getpass.getuser", side_effect=KeyError("x")), mock.patch("os.getuid", side_effect=AttributeError, create=True):
            self.assertEqual(private_folder_suffix(), "user")
