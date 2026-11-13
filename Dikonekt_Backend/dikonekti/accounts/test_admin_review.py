import os
import threading
from datetime import timedelta

from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import DoctorVerification
from accounts.test_helpers import (
    FAST_HASHER, JPEG, PDF, PNG, MediaRootMixin, make_admin, make_doctor, make_patient,
    stored_files, upload,
)

Status = DoctorVerification.Status
LIST = '/api/admin/verifications/'


def detail(pk, action=''):
    return f'/api/admin/verifications/{pk}/{action}'


def submitted_doctor(username, data=PDF, name='certificate.pdf', ctype='application/pdf', age_hours=0, **user_extra):
    doctor = make_doctor(username, Status.NOT_SUBMITTED)
    if user_extra:
        for key, value in user_extra.items():
            setattr(doctor, key, value)
        doctor.save()
    record = DoctorVerification.objects.get(user=doctor)
    record.submit(upload(data, name, ctype), {PDF: 'pdf', JPEG: 'jpeg', PNG: 'png'}[data])
    DoctorVerification.objects.filter(pk=record.pk).update(submitted_at=timezone.now() - timedelta(hours=age_hours))
    return DoctorVerification.objects.get(pk=record.pk)


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class AdminReviewApiTests(MediaRootMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    # --- who may call
    def test_doctors_patients_and_anonymous_callers_are_refused_everywhere(self):
        record = submitted_doctor('d1')
        calls = [
            ('get', LIST), ('get', detail(record.pk, 'document/')),
            ('post', detail(record.pk, 'approve/')), ('post', detail(record.pk, 'reject/')),
        ]
        callers = {
            'approved doctor': (make_doctor('docA'), 403),
            'the pending doctor themself': (record.user, 403),
            'patient': (make_patient('pat'), 403),
            'anonymous': (None, 401),
        }
        for label, (user, expected) in callers.items():
            client = APIClient()
            if user:
                client.force_authenticate(user)
            for method, url in calls:
                body = {'reason': 'x'} if url.endswith('reject/') else {}
                response = getattr(client, method)(url, body, format='json')
                self.assertEqual(response.status_code, expected, f'{label} {method} {url}')
        self.assertEqual(DoctorVerification.objects.get(pk=record.pk).status, Status.PENDING)

    def test_an_admin_gets_200_on_the_list(self):
        self.assertEqual(self.client.get(LIST).status_code, 200)

    # --- the list
    def test_the_list_defaults_to_pending_oldest_first_with_the_review_details(self):
        submitted_doctor('newer', age_hours=1)
        submitted_doctor('oldest', age_hours=5)
        submitted_doctor('middle', age_hours=3, specialization='Hearing', phone_number='+254711')
        make_doctor('approved_one')  # approved, must not show
        rows = self.client.get(LIST).json()
        self.assertEqual([r['username'] for r in rows], ['oldest', 'middle', 'newer'])
        row = rows[1]
        for key in ('id', 'username', 'display_name', 'specialization', 'area', 'phone_number',
                    'email', 'status', 'submitted_at', 'rejection_reason', 'reviewed_at'):
            self.assertIn(key, row)
        self.assertEqual(row['specialization'], 'Hearing')
        self.assertNotIn('document', str(row).lower().replace('display_name', ''))

    def test_the_list_filters_by_status(self):
        pending = submitted_doctor('p1')
        done = submitted_doctor('p2')
        done.approve(self.admin)
        refused = submitted_doctor('p3')
        refused.reject(self.admin, 'No')
        names = lambda q: sorted(r['username'] for r in self.client.get(LIST + q).json())
        self.assertEqual(names('?status=pending'), ['p1'])
        self.assertEqual(names('?status=approved'), ['p2'])
        self.assertEqual(names('?status=rejected'), ['p3'])
        self.assertEqual(names('?status=all'), ['p1', 'p2', 'p3'])
        self.assertEqual(pending.status, Status.PENDING)

    def test_all_includes_doctors_who_never_submitted(self):
        make_doctor('lazy', Status.NOT_SUBMITTED)
        self.assertIn('lazy', [r['username'] for r in self.client.get(LIST + '?status=all').json()])
        self.assertEqual(self.client.get(LIST).json(), [])

    def test_an_unknown_status_filter_is_a_400(self):
        self.assertEqual(self.client.get(LIST + '?status=bogus').status_code, 400)

    # --- the document
    def test_the_document_is_streamed_with_the_safe_headers_whatever_it_was_called(self):
        cases = ((PDF, 'application/pdf', 'evil"; filename=x.html', 'application/pdf'),
                 (JPEG, 'image/jpeg', 'Dr. Jane Doe.jpg', 'image/jpeg'),
                 (PNG, 'image/png', '../../etc/passwd.png', 'image/png'))
        for index, (data, ctype, name, expected) in enumerate(cases):
            record = submitted_doctor(f'd{index}', data, name, ctype, first_name='Jane "Doe" <b>')
            response = self.client.get(detail(record.pk, 'document/'))
            self.assertEqual(response.status_code, 200, name)
            self.assertEqual(response['Content-Type'], expected)
            self.assertEqual(response['Content-Disposition'], 'inline; filename="certificate"')
            self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
            self.assertEqual(response['Content-Security-Policy'], 'sandbox')
            self.assertEqual(b''.join(response.streaming_content), data)

    def test_the_content_type_follows_the_stored_bytes_not_the_upload_claim(self):
        record = submitted_doctor('d1', PNG, 'x.pdf', 'application/pdf')
        response = self.client.get(detail(record.pk, 'document/'))
        self.assertEqual(response['Content-Type'], 'image/png')

    def test_a_missing_file_or_record_is_404_not_500(self):
        record = submitted_doctor('d1')
        for path in stored_files(self.media_root):
            os.remove(path)
        self.assertEqual(self.client.get(detail(record.pk, 'document/')).status_code, 404)
        self.assertEqual(self.client.get(detail(999999, 'document/')).status_code, 404)
        never = DoctorVerification.objects.get(user=make_doctor('lazy', Status.NOT_SUBMITTED))
        self.assertEqual(self.client.get(detail(never.pk, 'document/')).status_code, 404)

    # --- decisions
    def test_approve_moves_pending_to_approved_and_records_who_and_when(self):
        record = submitted_doctor('d1')
        response = self.client.post(detail(record.pk, 'approve/'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'approved')
        record.refresh_from_db()
        self.assertEqual(record.reviewed_by, self.admin)
        self.assertIsNotNone(record.reviewed_at)
        self.assertEqual(self.client.get('/api/doctors/').json()[0]['username'], 'd1')

    def test_approving_a_record_that_is_not_pending_is_a_409(self):
        record = submitted_doctor('d1')
        self.client.post(detail(record.pk, 'approve/'))
        self.assertEqual(self.client.post(detail(record.pk, 'approve/')).status_code, 409)
        lazy = DoctorVerification.objects.get(user=make_doctor('lazy', Status.NOT_SUBMITTED))
        self.assertEqual(self.client.post(detail(lazy.pk, 'approve/')).status_code, 409)

    def test_a_second_admin_cannot_override_the_first_decision(self):
        record = submitted_doctor('d1')
        self.client.post(detail(record.pk, 'approve/'))
        stamp = DoctorVerification.objects.get(pk=record.pk).reviewed_at
        second = APIClient()
        second.force_authenticate(make_admin('boss2'))
        response = second.post(detail(record.pk, 'reject/'), {'reason': 'late'}, format='json')
        self.assertEqual(response.status_code, 200)  # revoking an approved doctor is allowed
        again = second.post(detail(record.pk, 'reject/'), {'reason': 'again'}, format='json')
        self.assertEqual(again.status_code, 409)
        saved = DoctorVerification.objects.get(pk=record.pk)
        self.assertEqual(saved.rejection_reason, 'late')
        self.assertNotEqual(saved.reviewed_at, stamp)

    def test_reject_needs_a_reason_between_1_and_500_characters(self):
        record = submitted_doctor('d1')
        url = detail(record.pk, 'reject/')
        for body in ({}, {'reason': ''}, {'reason': '   '}, {'reason': 'x' * 501}, {'reason': None}):
            self.assertEqual(self.client.post(url, body, format='json').status_code, 400, body)
        self.assertEqual(DoctorVerification.objects.get(pk=record.pk).status, Status.PENDING)
        ok = self.client.post(url, {'reason': ' ' + 'x' * 500 + ' '}, format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()['rejection_reason'], 'x' * 500)

    def test_rejecting_a_never_submitted_doctor_is_a_409(self):
        lazy = DoctorVerification.objects.get(user=make_doctor('lazy', Status.NOT_SUBMITTED))
        response = self.client.post(detail(lazy.pk, 'reject/'), {'reason': 'x'}, format='json')
        self.assertEqual(response.status_code, 409)

    def test_unknown_record_ids_are_404(self):
        self.assertEqual(self.client.post(detail(999999, 'approve/')).status_code, 404)
        self.assertEqual(self.client.post(detail(999999, 'reject/'), {'reason': 'x'}, format='json').status_code, 404)

    def test_revoking_clears_the_doctor_from_their_patients(self):
        record = submitted_doctor('d1')
        record.approve(self.admin)
        patient = make_patient('pat', record.user)
        response = self.client.post(detail(record.pk, 'reject/'), {'reason': 'Licence expired'}, format='json')
        self.assertEqual(response.status_code, 200)
        patient.refresh_from_db()
        self.assertIsNone(patient.registered_doctor)

    def test_get_is_not_allowed_on_the_decision_endpoints(self):
        record = submitted_doctor('d1')
        self.assertEqual(self.client.get(detail(record.pk, 'approve/')).status_code, 405)
        self.assertEqual(self.client.get(detail(record.pk, 'reject/')).status_code, 405)


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class SimultaneousDecisionTests(MediaRootMixin, TransactionTestCase):
    def test_two_admins_rejecting_the_same_pending_record_give_one_success_and_one_409(self):
        record = submitted_doctor('d1')
        admins = [make_admin('a1'), make_admin('a2')]
        barrier = threading.Barrier(2)
        codes = []

        def decide(admin, reason):
            try:
                client = APIClient()
                client.force_authenticate(admin)
                barrier.wait(timeout=10)
                codes.append(client.post(detail(record.pk, 'reject/'), {'reason': reason}, format='json').status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=decide, args=(admins[0], 'first')),
                   threading.Thread(target=decide, args=(admins[1], 'second'))]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        self.assertEqual(sorted(codes), [200, 409])
        self.assertEqual(DoctorVerification.objects.get(pk=record.pk).status, Status.REJECTED)

    def test_two_admins_approving_the_same_record_give_one_success_and_one_409(self):
        record = submitted_doctor('d1')
        admins = [make_admin('a1'), make_admin('a2')]
        barrier = threading.Barrier(2)
        codes = []

        def decide(admin):
            try:
                client = APIClient()
                client.force_authenticate(admin)
                barrier.wait(timeout=10)
                codes.append(client.post(detail(record.pk, 'approve/')).status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=decide, args=(a,)) for a in admins]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        self.assertEqual(sorted(codes), [200, 409])
        self.assertEqual(DoctorVerification.objects.get(pk=record.pk).status, Status.APPROVED)
