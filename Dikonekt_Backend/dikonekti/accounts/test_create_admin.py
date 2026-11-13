from io import StringIO
from unittest import mock

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from accounts.models import User
from accounts.test_helpers import FAST_HASHER, make_doctor

GETPASS = 'accounts.management.commands.create_admin.getpass'
STRONG = 'Correct-Horse-9-Battery'


def run(username, *passwords):
    out = StringIO()
    with mock.patch(GETPASS, side_effect=list(passwords)):
        call_command('create_admin', username, stdout=out)
    return out.getvalue()


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class CreateAdminTests(TestCase):
    def test_it_creates_an_admin_whose_password_works_and_is_not_stored_in_clear(self):
        output = run('boss', STRONG, STRONG)
        user = User.objects.get(username='boss')
        self.assertEqual(user.role, 'admin')
        self.assertTrue(user.check_password(STRONG))
        self.assertNotIn(STRONG, user.password)
        self.assertNotIn(STRONG, output)
        self.assertIn('boss', output)

    def test_the_new_admin_can_log_in_and_has_no_verification_status(self):
        run('boss', STRONG, STRONG)
        from rest_framework.test import APIClient
        response = APIClient().post('/api/auth/login/', {'username': 'boss', 'password': STRONG}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['profile']['role'], 'admin')
        self.assertIsNone(response.json()['profile']['verification_status'])

    def test_an_existing_username_is_refused_whatever_its_case_and_nothing_changes(self):
        make_doctor('boss')
        for name in ('boss', 'BOSS'):
            with self.assertRaises(CommandError):
                run(name, STRONG, STRONG)
        self.assertEqual(User.objects.filter(username__iexact='boss').count(), 1)
        self.assertEqual(User.objects.get(username='boss').role, 'doctor')

    def test_a_weak_password_is_refused(self):
        for weak in ('12345678', 'password', 'short'):
            with self.assertRaises(CommandError, msg=weak):
                run('boss', weak, weak)
        with self.assertRaises(CommandError):  # too close to the username
            run('administrator', 'administrator1', 'administrator1')
        self.assertFalse(User.objects.exists())

    def test_passwords_that_do_not_match_are_refused(self):
        with self.assertRaises(CommandError) as caught:
            run('boss', STRONG, STRONG + 'x')
        self.assertIn('match', str(caught.exception))
        self.assertFalse(User.objects.filter(username='boss').exists())

    def test_a_blank_username_is_refused(self):
        for name in ('', '   '):
            with self.assertRaises(CommandError):
                run(name, STRONG, STRONG)
        self.assertFalse(User.objects.exists())
