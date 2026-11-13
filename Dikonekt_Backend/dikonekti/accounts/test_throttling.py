import contextlib
import fcntl
import json
import os
import multiprocessing
import tempfile
import threading
import time
from types import SimpleNamespace
from unittest import mock, skipIf

from django.conf import settings
from django.core.cache import cache
from django.core.cache.backends.locmem import LocMemCache
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient, APITestCase

from accounts import throttles
from accounts.models import DoctorVerification, User
from accounts.throttles import LoginHourThrottle, LoginMinuteThrottle, RegisterThrottle

# Password hashing is deliberately slow; these tests make hundreds of login attempts.
FAST_HASHER = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "throttle-tests"}}
def file_cache(folder):
    return {"default": {"BACKEND": "django.core.cache.backends.filebased.FileBasedCache", "LOCATION": str(folder)}}


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
        doctor = User.objects.create_user(username="dr1", password=PASSWORD, role="doctor")
        DoctorVerification.objects.create(user=doctor, status="approved")

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

    def test_requests_the_minute_limit_refused_do_not_use_up_the_hourly_allowance(self):
        # A locked-out user keeps pressing Log in: 5 attempts are allowed, 25 are refused.
        for _ in range(30):
            self.login()
        self.clock.advance(61)
        self.assertEqual(self.login().status_code, 401)
        self.clock.advance(600)
        self.assertEqual(self.login(password=PASSWORD).status_code, 200)

    def test_the_wait_after_a_minute_refusal_is_about_a_minute_not_an_hour(self):
        for _ in range(6):
            self.login()
        self.assertLessEqual(int(self.login()["Retry-After"]), 60)

    def test_attempts_that_reach_the_password_check_still_count_toward_the_hour(self):
        for _ in range(6):  # six minutes of five real attempts
            for _ in range(5):
                self.login()
            self.clock.advance(61)
        self.assertEqual(self.login().status_code, 429)

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


def within(seconds, function):
    """Run `function` in a thread; fail the test instead of hanging if it does not finish."""
    result = {}
    worker = threading.Thread(target=lambda: result.update(value=function()), daemon=True)
    worker.start()
    worker.join(seconds)
    if worker.is_alive():
        raise AssertionError(f"still blocked after {seconds} seconds")
    return result["value"]


@override_settings(CACHES=LOCMEM)
class StuckLockTests(SimpleTestCase):
    """A limiter that cannot get its lock must never stall login: it lets the request through and logs."""

    def setUp(self):
        cache.clear()
        patcher = mock.patch.object(throttles, "LOCK_TIMEOUT_SECONDS", 0.2)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_stuck_thread_lock_lets_the_request_through_and_logs_an_error(self):
        throttles._THREAD_LOCK.acquire()
        try:
            with self.assertLogs("accounts.throttles", level="ERROR") as logs:
                allowed = within(5, lambda: LoginMinuteThrottle().allow_request(fake_request("stuck"), None))
        finally:
            throttles._THREAD_LOCK.release()
        self.assertTrue(allowed)
        self.assertIn("lock", logs.output[0].lower())

    def test_a_stuck_file_lock_lets_the_request_through_and_logs_an_error(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            handle = open(f"{folder}/.throttle.lock", "a")
            fcntl.flock(handle, fcntl.LOCK_EX)  # another worker is holding the lock
            try:
                with self.assertLogs("accounts.throttles", level="ERROR"):
                    allowed = within(5, lambda: LoginMinuteThrottle().allow_request(fake_request("stuck"), None))
            finally:
                handle.close()
            self.assertTrue(allowed)
            self.assertFalse(throttles._THREAD_LOCK.locked(), "the in-process lock must be released after giving up")

    def test_the_limiter_works_normally_again_once_the_lock_is_free(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            handle = open(f"{folder}/.throttle.lock", "a")
            fcntl.flock(handle, fcntl.LOCK_EX)
            with self.assertLogs("accounts.throttles", level="ERROR"):
                within(5, lambda: LoginMinuteThrottle().allow_request(fake_request("back"), None))
            handle.close()
            results = [LoginMinuteThrottle().allow_request(fake_request("back"), None) for _ in range(7)]
        self.assertEqual(results.count(True), 5)

    def test_a_normal_request_logs_nothing(self):
        with self.assertNoLogs("accounts.throttles", level="ERROR"):
            self.assertTrue(LoginMinuteThrottle().allow_request(fake_request("fine"), None))

    def test_the_lock_is_not_leaked_by_normal_use(self):
        LoginMinuteThrottle().allow_request(fake_request("fine"), None)
        self.assertFalse(throttles._THREAD_LOCK.locked())


class LimiterFailureTests(SimpleTestCase):
    """Any trouble inside the limiter itself (not only a busy lock) must let the request through and log."""

    def test_an_unusable_lock_file_lets_the_request_through_and_logs(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            os.mkdir(f"{folder}/.throttle.lock")  # opening it as a file fails
            with self.assertLogs("accounts.throttles", level="ERROR"):
                self.assertTrue(LoginMinuteThrottle().allow_request(fake_request("a"), None))
            self.assertFalse(throttles._THREAD_LOCK.locked(), "the in-process lock must be released after a failure")

    @skipIf(os.geteuid() == 0, "root can write anywhere")
    def test_a_folder_that_became_read_only_lets_the_request_through_and_logs(self):
        with tempfile.TemporaryDirectory() as folder, override_settings(CACHES=file_cache(folder)):
            LoginMinuteThrottle().allow_request(fake_request("b"), None)  # creates the lock and a cache file
            for name in os.listdir(folder):
                os.chmod(os.path.join(folder, name), 0o400)
            os.chmod(folder, 0o500)
            try:
                with self.assertLogs("accounts.throttles", level="ERROR"):
                    self.assertTrue(LoginMinuteThrottle().allow_request(fake_request("b"), None))
            finally:
                os.chmod(folder, 0o700)

    @override_settings(CACHES=LOCMEM)
    def test_a_cache_write_failure_such_as_a_full_disk_lets_the_request_through_and_logs(self):
        cache.clear()
        with mock.patch.object(LocMemCache, "set", side_effect=OSError(28, "No space left on device")):
            with self.assertLogs("accounts.throttles", level="ERROR"):
                self.assertTrue(LoginMinuteThrottle().allow_request(fake_request("c"), None))
        throttles_after = [LoginMinuteThrottle().allow_request(fake_request("c"), None) for _ in range(7)]
        self.assertEqual(throttles_after.count(True), 5)  # back to normal once the cache works

    @override_settings(CACHES=LOCMEM)
    def test_other_kinds_of_errors_are_not_hidden(self):
        with mock.patch.object(LocMemCache, "set", side_effect=TypeError("a real bug")):
            with self.assertRaises(TypeError):
                LoginMinuteThrottle().allow_request(fake_request("d"), None)


@contextlib.contextmanager
def another_thread_holding_the_lock():
    """Hold the limiter's in-process lock from a different thread, like a stuck worker thread."""
    held, release = threading.Event(), threading.Event()

    def hold():
        with throttles._THREAD_LOCK:
            held.set()
            release.wait(10)

    holder = threading.Thread(target=hold, daemon=True)
    holder.start()
    assert held.wait(5), "the helper thread never got the lock"
    try:
        yield
    finally:
        release.set()
        holder.join(5)


@override_settings(CACHES=LOCMEM, PASSWORD_HASHERS=FAST_HASHER)
class StuckLockLoginTests(ThrottleTestCase):
    def test_a_stuck_lock_costs_one_timeout_not_one_per_throttle(self):
        with mock.patch.object(throttles, "LOCK_TIMEOUT_SECONDS", 0.4), another_thread_holding_the_lock():
            started = time.monotonic()
            with self.assertLogs("accounts.throttles", level="ERROR") as logs:
                self.login(password=PASSWORD)
            waited = time.monotonic() - started
        self.assertLess(waited, 0.7, f"waited {waited:.2f}s: the second throttle waited for the lock again")
        self.assertEqual(len(logs.output), 1, "the failure is logged once per request")

    def test_login_still_answers_normally_while_the_limiter_is_stuck(self):
        # The request runs on this thread (so it sees the test database); another thread holds the lock.
        with mock.patch.object(throttles, "LOCK_TIMEOUT_SECONDS", 0.2), another_thread_holding_the_lock():
            started = time.monotonic()
            with self.assertLogs("accounts.throttles", level="ERROR"):
                response = self.login(password=PASSWORD)
            waited = time.monotonic() - started
        self.assertEqual(response.status_code, 200)
        self.assertLess(waited, 5)

    def test_a_wrong_password_is_still_refused_while_the_limiter_is_stuck(self):
        with mock.patch.object(throttles, "LOCK_TIMEOUT_SECONDS", 0.2), another_thread_holding_the_lock():
            with self.assertLogs("accounts.throttles", level="ERROR"):
                self.assertEqual(self.login(password="wrong").status_code, 401)
