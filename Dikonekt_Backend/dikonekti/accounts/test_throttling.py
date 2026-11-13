import json
import multiprocessing
import tempfile
import threading
import time
from types import SimpleNamespace
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.core.cache.backends.locmem import LocMemCache
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from accounts.throttles import LoginHourThrottle, LoginMinuteThrottle, RegisterThrottle

# Password hashing is deliberately slow; these tests make hundreds of login attempts.
FAST_HASHER = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "throttle-tests"}}
LOGIN = "/api/auth/login/"
REGISTER = "/api/auth/register/"
PASSWORD = "Correct#Horse2026"


class Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def advance(self, seconds):
        self.now += seconds

    def __call__(self):
        return self.now


@override_settings(CACHES=LOCMEM, PASSWORD_HASHERS=FAST_HASHER)
class ThrottleTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.clock = Clock()
        for throttle in (LoginMinuteThrottle, LoginHourThrottle, RegisterThrottle):
            patcher = mock.patch.object(throttle, "timer", staticmethod(self.clock))
            patcher.start()
            self.addCleanup(patcher.stop)
        User.objects.create_user(username="dr1", password=PASSWORD, role="doctor")

    def login(self, username="dr1", password="wrong", **extra):
        return self.client.post(LOGIN, {"username": username, "password": password}, format="json", **extra)

    def attempt_register(self, **extra):
        return self.client.post(REGISTER, {}, format="json", **extra)


class LoginThrottleTests(ThrottleTestCase):
    def test_the_sixth_attempt_in_a_minute_is_throttled_even_with_the_correct_password(self):
        for _ in range(5):
            self.assertEqual(self.login().status_code, 401)
        response = self.login(password=PASSWORD)
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response["Retry-After"]), 0)
        self.assertIn("throttled", response.json()["detail"].lower())
        self.assertNotIn("access", response.json())

    def test_successful_logins_count_toward_the_limit_too(self):
        for _ in range(5):
            self.assertEqual(self.login(password=PASSWORD).status_code, 200)
        self.assertEqual(self.login(password=PASSWORD).status_code, 429)

    def test_the_username_is_matched_ignoring_case_and_surrounding_spaces(self):
        for name in ("dr1", "DR1", " Dr1 ", "dR1", "dr1"):
            self.assertEqual(self.login(username=name).status_code, 401)
        self.assertEqual(self.login(username="  DR1").status_code, 429)

    def test_a_different_username_is_not_affected(self):
        for _ in range(6):
            self.login()
        self.assertEqual(self.login().status_code, 429)
        self.assertEqual(self.login(username="someone_else").status_code, 401)

    def test_the_same_username_can_try_again_after_the_minute_passes(self):
        for _ in range(6):
            self.login()
        self.clock.advance(61)
        self.assertEqual(self.login(password=PASSWORD).status_code, 200)

    def test_the_hourly_limit_blocks_a_31st_attempt_even_when_each_minute_is_clear(self):
        for _ in range(6):  # six minutes of five attempts = 30 attempts
            for _ in range(5):
                self.assertEqual(self.login().status_code, 401)
            self.clock.advance(61)
        response = self.login()
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response["Retry-After"]), 60)

    def test_the_hourly_limit_resets_after_an_hour(self):
        for _ in range(6):
            for _ in range(5):
                self.login()
            self.clock.advance(61)
        self.clock.advance(3600)
        self.assertEqual(self.login().status_code, 401)

    def test_different_client_addresses_do_not_help_an_attacker_against_one_username(self):
        for i in range(5):
            self.assertEqual(self.login(REMOTE_ADDR=f"10.0.0.{i}").status_code, 401)
        self.assertEqual(self.login(REMOTE_ADDR="10.0.0.99").status_code, 429)

    def test_one_client_address_does_not_lock_out_other_usernames(self):
        for i in range(8):
            self.assertEqual(self.login(username=f"user{i}", REMOTE_ADDR="10.0.0.1").status_code, 401)

    def test_unusable_bodies_do_not_crash_and_are_not_throttled_by_username(self):
        bodies = ["[1, 2]", "null", "{}", '{"username": 5}', '{"username": "   "}', '{"username": null}', '"text"', "not json"]
        for body in bodies:
            for _ in range(7):
                response = self.client.post(LOGIN, data=body, content_type="application/json")
                self.assertEqual(response.status_code, 400, body)
        self.assertEqual(self.login().status_code, 401)

    def test_a_username_given_as_form_data_is_throttled_too(self):
        for _ in range(5):
            self.client.post(LOGIN, {"username": "dr1", "password": "wrong"})
        self.assertEqual(self.client.post(LOGIN, {"username": "dr1", "password": "wrong"}).status_code, 429)


class ClientAddressTrustTests(ThrottleTestCase):
    """The register limit must key on the real connection, not on a header the client controls."""

    def test_a_spoofed_forwarded_for_header_does_not_get_a_fresh_allowance(self):
        for i in range(5):
            self.assertEqual(self.attempt_register(HTTP_X_FORWARDED_FOR=f"203.0.113.{i}").status_code, 400)
        self.assertEqual(self.attempt_register(HTTP_X_FORWARDED_FOR="203.0.113.200").status_code, 429)

    def test_behind_one_trusted_proxy_only_the_last_hop_counts(self):
        rest = {"DEFAULT_THROTTLE_RATES": {"login_minute": "5/min", "login_hour": "30/hour", "register": "5/hour"}, "NUM_PROXIES": 1}
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, **rest}):
            for i in range(5):  # the client invents the first address each time; the proxy appended the real one
                self.assertEqual(self.attempt_register(HTTP_X_FORWARDED_FOR=f"6.6.6.{i}, 9.9.9.9").status_code, 400)
            self.assertEqual(self.attempt_register(HTTP_X_FORWARDED_FOR="7.7.7.7, 9.9.9.9").status_code, 429)
            self.assertEqual(self.attempt_register(HTTP_X_FORWARDED_FOR="7.7.7.7, 8.8.8.8").status_code, 400)


class RegisterThrottleTests(ThrottleTestCase):
    def test_the_sixth_registration_from_one_address_in_an_hour_is_throttled(self):
        for _ in range(5):
            self.assertEqual(self.attempt_register().status_code, 400)
        response = self.attempt_register()
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response["Retry-After"]), 0)

    def test_a_different_address_is_not_affected(self):
        for _ in range(6):
            self.attempt_register(REMOTE_ADDR="10.0.0.1")
        self.assertEqual(self.attempt_register(REMOTE_ADDR="10.0.0.1").status_code, 429)
        self.assertEqual(self.attempt_register(REMOTE_ADDR="10.0.0.2").status_code, 400)

    def test_the_limit_resets_after_an_hour(self):
        for _ in range(6):
            self.attempt_register()
        self.clock.advance(3601)
        self.assertEqual(self.attempt_register().status_code, 400)

    def test_logging_in_does_not_use_up_the_registration_allowance(self):
        for _ in range(5):
            self.login()
        self.assertEqual(self.attempt_register().status_code, 400)


class OtherEndpointsAreNotThrottledTests(ThrottleTestCase):
    def test_token_refresh_is_never_throttled(self):
        for _ in range(20):
            response = self.client.post("/api/auth/refresh/", {"refresh": "garbage"}, format="json")
            self.assertEqual(response.status_code, 401)

    def test_other_endpoints_are_unaffected(self):
        for _ in range(20):
            self.assertEqual(self.client.get("/api/doctors/").status_code, 200)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="dr1"))
        for _ in range(20):
            self.assertEqual(client.get("/api/alerts/").status_code, 200)

    def test_throttling_on_login_leaves_an_already_issued_token_working(self):
        token = self.login(password=PASSWORD).json()["access"]
        for _ in range(6):
            self.login()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(client.get("/api/me/").status_code, 200)


class SlowLocMemCache(LocMemCache):
    """A cache whose writes take a moment, so an unprotected read-modify-write always races."""

    def set(self, *args, **kwargs):
        time.sleep(0.003)
        return super().set(*args, **kwargs)


def fake_request(username="racer"):
    return SimpleNamespace(data={"username": username}, META={"REMOTE_ADDR": "10.0.0.1"}, headers={})


def burst(throttle_class, request, attempts):
    """Run `attempts` simultaneous allow_request calls and count how many were allowed."""
    barrier = threading.Barrier(attempts)
    allowed = []

    def worker():
        barrier.wait()
        allowed.append(throttle_class().allow_request(request, None))

    threads = [threading.Thread(target=worker) for _ in range(attempts)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return allowed.count(True)


@override_settings(CACHES={"default": {"BACKEND": "accounts.test_throttling.SlowLocMemCache", "LOCATION": "race-tests"}})
class ParallelRequestTests(SimpleTestCase):
    """A burst of simultaneous requests must not get more than the allowed number through."""

    def setUp(self):
        cache.clear()

    def test_a_parallel_burst_of_logins_gets_exactly_the_minute_allowance_through(self):
        self.assertEqual(burst(LoginMinuteThrottle, fake_request(), 25), 5)

    def test_a_parallel_burst_of_hourly_checks_gets_exactly_the_hour_allowance_through(self):
        self.assertEqual(burst(LoginHourThrottle, fake_request("hourly"), 40), 30)

    def test_a_parallel_burst_of_registrations_gets_exactly_the_allowance_through(self):
        self.assertEqual(burst(RegisterThrottle, fake_request(), 25), 5)

    def test_separate_usernames_do_not_use_each_others_allowance_in_parallel(self):
        self.assertEqual(burst(LoginMinuteThrottle, fake_request("alice"), 10), 5)
        self.assertEqual(burst(LoginMinuteThrottle, fake_request("bob"), 10), 5)


def _attempts_in_a_worker_process(count):
    return sum(LoginMinuteThrottle().allow_request(fake_request("multi"), None) for _ in range(count))


class SeveralWorkerProcessesTests(SimpleTestCase):
    """The file-based cache is shared by every worker process on a host, so the limit must hold across them."""

    def test_separate_processes_share_one_allowance(self):
        with tempfile.TemporaryDirectory() as folder:
            caches = {"default": {"BACKEND": "django.core.cache.backends.filebased.FileBasedCache", "LOCATION": folder}}
            with override_settings(CACHES=caches):
                cache.clear()
                with multiprocessing.get_context("fork").Pool(6) as pool:
                    allowed = sum(pool.map(_attempts_in_a_worker_process, [8] * 6))
        self.assertEqual(allowed, 5)
