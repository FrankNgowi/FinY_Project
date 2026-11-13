import os
import stat
import threading
from unittest import mock

from django.core.cache import cache
from django.db import connection
from django.test.client import BOUNDARY, encode_multipart
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from accounts import files
from accounts.models import DoctorVerification, User
from accounts.test_helpers import (
    FAST_HASHER, JPEG, PDF, PNG, MediaRootMixin, make_admin, make_doctor, make_patient,
    make_user, stored_files, upload,
)

Status = DoctorVerification.Status
URL = '/api/me/verification/'
LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'verification-tests'}}


def post_document(client, document=None, **extra):
    return client.post(URL, {'document': document or upload()}, format='multipart', **extra)


@override_settings(PASSWORD_HASHERS=FAST_HASHER, CACHES=LOCMEM)
class DoctorVerificationApiTests(MediaRootMixin, TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.doctor = make_doctor('doc', Status.NOT_SUBMITTED)
        self.client = APIClient()
        self.client.force_authenticate(self.doctor)

    def status_of(self, user=None):
        return DoctorVerification.objects.get(user=user or self.doctor).status

    # --- the profile
    def test_me_shows_the_status_for_a_doctor_and_null_for_everyone_else(self):
        self.assertEqual(self.client.get('/api/me/').json()['verification_status'], 'not_submitted')
        for user in (make_patient('pat'), make_admin('boss')):
            other = APIClient()
            other.force_authenticate(user)
            self.assertIsNone(other.get('/api/me/').json()['verification_status'])

    def test_a_doctor_with_no_record_reads_not_submitted_and_can_upload(self):
        bare = make_user('bare', User.Role.DOCTOR)
        client = APIClient()
        client.force_authenticate(bare)
        self.assertEqual(client.get(URL).json()['status'], 'not_submitted')
        self.assertEqual(post_document(client).status_code, 200)
        self.assertEqual(self.status_of(bare), Status.PENDING)

    def test_a_new_registration_starts_not_submitted(self):
        response = APIClient().post('/api/auth/register/', {
            'username': 'newdoc', 'password': 'pw-Strong-123!', 'role': 'doctor',
            'first_name': 'N', 'area': 'Stone Town', 'phone_number': '+2547', 'specialization': 'Vision',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['profile']['verification_status'], 'not_submitted')

    # --- uploading
    def test_valid_pdf_jpeg_and_png_are_accepted(self):
        for data, name, ctype in ((PDF, 'a.pdf', 'application/pdf'), (JPEG, 'a.jpg', 'image/jpeg'),
                                  (PNG, 'a.png', 'image/png')):
            DoctorVerification.objects.filter(user=self.doctor).update(status=Status.NOT_SUBMITTED)
            response = post_document(self.client, upload(data, name, ctype))
            self.assertEqual(response.status_code, 200, name)
            self.assertEqual(response.json()['status'], 'pending')

    def test_the_response_never_contains_a_path_or_url(self):
        post_document(self.client)
        for body in (self.client.get(URL).json(), self.client.get('/api/me/').json()):
            text = str(body).lower()
            self.assertNotIn('document', text)
            self.assertNotIn('.pdf', text)
            self.assertNotIn('/media', text)
        self.assertEqual(set(self.client.get(URL).json()), {'status', 'submitted_at', 'rejection_reason'})

    def test_bad_files_are_refused_with_400_and_the_status_does_not_change(self):
        too_big = PDF + b'0' * files.MAX_FILE_BYTES
        cases = {
            'oversize': upload(too_big),
            'exe renamed to pdf': upload(b'MZ\x90\x00' + b'0' * 50, 'cert.pdf', 'application/pdf'),
            'html as png': upload(b'<html></html>', 'cert.png', 'image/png'),
            'empty': upload(b''),
        }
        for label, document in cases.items():
            response = post_document(self.client, document)
            self.assertEqual(response.status_code, 400, label)
            self.assertIn('document', response.json(), label)
            self.assertEqual(self.status_of(), Status.NOT_SUBMITTED, label)
        self.assertEqual(stored_files(self.media_root), [])

    def test_a_request_with_no_file_is_refused(self):
        response = self.client.post(URL, {}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertIn('document', response.json())

    def test_a_declared_body_over_6mb_is_refused_with_413_and_nothing_is_written(self):
        response = post_document(self.client, CONTENT_LENGTH=str(files.MAX_BODY_BYTES + 1))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json(), {'detail': 'File too large (max 5 MB).'})
        self.assertEqual(stored_files(self.media_root), [])
        self.assertEqual(self.status_of(), Status.NOT_SUBMITTED)

    def test_the_body_limit_is_inclusive_a_body_of_exactly_the_limit_is_read(self):
        body = encode_multipart(BOUNDARY, {'document': upload()})
        content_type = f'multipart/form-data; boundary={BOUNDARY}'
        with mock.patch.object(files, 'MAX_BODY_BYTES', len(body) - 1):
            self.assertEqual(self.client.post(URL, body, content_type=content_type).status_code, 413)
        with mock.patch.object(files, 'MAX_BODY_BYTES', len(body)):
            self.assertEqual(self.client.post(URL, body, content_type=content_type).status_code, 200)

    def test_a_garbage_content_length_does_not_crash(self):
        response = post_document(self.client, CONTENT_LENGTH='lots')
        self.assertIn(response.status_code, (200, 400))

    def test_the_size_check_does_not_let_anonymous_callers_probe(self):
        response = post_document(APIClient(), CONTENT_LENGTH=str(files.MAX_BODY_BYTES + 1))
        self.assertEqual(response.status_code, 401)

    def test_uploading_while_pending_or_approved_is_a_409_and_keeps_one_file(self):
        post_document(self.client)
        for status in (Status.PENDING, Status.APPROVED):
            DoctorVerification.objects.filter(user=self.doctor).update(status=status)
            response = post_document(self.client)
            self.assertEqual(response.status_code, 409, status)
        self.assertEqual(len(stored_files(self.media_root)), 1)

    def test_a_rejected_doctor_can_resubmit_and_the_old_file_goes(self):
        admin = make_admin()
        post_document(self.client)
        DoctorVerification.objects.get(user=self.doctor).reject(admin, 'Blurry')
        self.assertEqual(self.client.get(URL).json()['rejection_reason'], 'Blurry')
        with self.captureOnCommitCallbacks(execute=True):
            response = post_document(self.client, upload(JPEG, 'b.jpg', 'image/jpeg'))
        self.assertEqual(response.status_code, 200)
        body = self.client.get(URL).json()
        self.assertEqual(body['status'], 'pending')
        self.assertEqual(body['rejection_reason'], '')
        self.assertEqual(len(stored_files(self.media_root)), 1)

    def test_stored_files_and_their_folder_are_private_to_the_owner(self):
        post_document(self.client)
        path = stored_files(self.media_root)[0]
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode) & 0o077, 0)
        self.assertEqual(stat.S_IMODE(os.stat(os.path.dirname(path)).st_mode) & 0o077, 0)

    def test_a_storage_failure_is_a_503_that_changes_nothing_and_is_logged(self):
        with mock.patch('django.core.files.storage.FileSystemStorage.save', side_effect=PermissionError(13, 'denied')):
            with self.assertLogs('accounts', level='ERROR'):
                response = post_document(self.client)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('denied', response.content.decode())  # no internals in the answer
        self.assertEqual(self.status_of(), Status.NOT_SUBMITTED)
        self.assertEqual(stored_files(self.media_root), [])

    def test_the_doctor_can_try_again_after_a_storage_failure(self):
        with mock.patch('django.core.files.storage.FileSystemStorage.save', side_effect=OSError('disk full')):
            with self.assertLogs('accounts', level='ERROR'):
                post_document(self.client)
        self.assertEqual(post_document(self.client).status_code, 200)

    # --- who may call it
    def test_only_doctors_may_use_the_endpoint(self):
        for user in (make_patient('pat'), make_admin('boss')):
            other = APIClient()
            other.force_authenticate(user)
            self.assertEqual(other.get(URL).status_code, 403)
            self.assertEqual(post_document(other).status_code, 403)
        self.assertEqual(APIClient().get(URL).status_code, 401)

    def test_a_doctor_only_ever_sees_and_changes_their_own_record(self):
        other = make_doctor('doc2', Status.NOT_SUBMITTED)
        other_client = APIClient()
        other_client.force_authenticate(other)
        post_document(self.client)
        self.assertEqual(other_client.get(URL).json()['status'], 'not_submitted')
        self.assertEqual(self.status_of(other), Status.NOT_SUBMITTED)

    def test_an_unapproved_doctor_can_still_use_the_verification_endpoints(self):
        self.assertEqual(self.client.get('/api/me/').status_code, 200)
        self.assertEqual(self.client.get(URL).status_code, 200)

    # --- the upload limit
    def test_the_eleventh_upload_in_an_hour_is_a_429_with_retry_after(self):
        for _ in range(10):
            post_document(self.client)
        response = post_document(self.client)
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response)

    def test_another_doctor_is_not_limited_by_the_first_and_the_ip_is_not_shared(self):
        other = make_doctor('doc2', Status.NOT_SUBMITTED)
        other_client = APIClient()
        other_client.force_authenticate(other)
        for _ in range(11):
            post_document(self.client)
        self.assertEqual(post_document(other_client).status_code, 200)

    def test_reading_the_status_does_not_use_up_uploads(self):
        for _ in range(30):
            self.assertEqual(self.client.get(URL).status_code, 200)
        self.assertEqual(post_document(self.client).status_code, 200)


@override_settings(PASSWORD_HASHERS=FAST_HASHER, CACHES=LOCMEM)
class SimultaneousUploadTests(MediaRootMixin, TransactionTestCase):
    def test_two_simultaneous_uploads_give_one_success_one_409_and_one_file(self):
        cache.clear()
        doctor = make_doctor('doc', Status.NOT_SUBMITTED)
        barrier = threading.Barrier(2)
        codes = []

        def attempt():
            try:
                client = APIClient()
                client.force_authenticate(doctor)
                barrier.wait(timeout=10)
                codes.append(post_document(client).status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        self.assertEqual(sorted(codes), [200, 409])
        self.assertEqual(len(stored_files(self.media_root)), 1)
