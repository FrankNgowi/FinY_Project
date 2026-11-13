from unittest import mock

from django.db import DatabaseError
from django.test import TestCase, override_settings

from accounts.models import DoctorVerification, InvalidTransition, User
from accounts.test_helpers import (
    FAST_HASHER, JPEG, PDF, MediaRootMixin, make_admin, make_doctor, make_patient,
    make_user, stored_files, upload,
)

Status = DoctorVerification.Status


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class VerificationModelTests(MediaRootMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.doctor = make_doctor('doc', Status.NOT_SUBMITTED)
        self.admin = make_admin()
        self.record = DoctorVerification.objects.get(user=self.doctor)

    def submit(self, record=None, data=PDF, kind='pdf'):
        (record or self.record).submit(upload(data), kind)

    def test_new_record_starts_not_submitted(self):
        self.assertEqual(self.record.status, Status.NOT_SUBMITTED)

    def test_for_user_creates_a_missing_record_and_reuses_it(self):
        bare = make_user('bare', User.Role.DOCTOR)
        self.assertFalse(DoctorVerification.objects.filter(user=bare).exists())
        first = DoctorVerification.for_user(bare)
        again = DoctorVerification.for_user(bare)
        self.assertEqual(first.pk, again.pk)
        self.assertEqual(first.status, Status.NOT_SUBMITTED)

    def test_verification_status_property_per_role(self):
        self.assertEqual(self.doctor.verification_status, 'not_submitted')
        self.assertIsNone(self.admin.verification_status)
        self.assertIsNone(make_patient().verification_status)
        self.assertEqual(make_user('bare', User.Role.DOCTOR).verification_status, 'not_submitted')

    def test_submit_stores_the_file_under_a_random_name_and_goes_pending(self):
        self.submit()
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, Status.PENDING)
        self.assertIsNotNone(self.record.submitted_at)
        paths = stored_files(self.media_root)
        self.assertEqual(len(paths), 1)
        self.assertTrue(paths[0].endswith('.pdf'))
        self.assertNotIn('certificate', paths[0])

    def test_submit_is_refused_while_pending_or_approved_and_writes_nothing(self):
        self.submit()
        for status in (Status.PENDING, Status.APPROVED):
            DoctorVerification.objects.filter(pk=self.record.pk).update(status=status)
            with self.assertRaises(InvalidTransition):
                self.submit()
        self.assertEqual(len(stored_files(self.media_root)), 1)

    def test_resubmit_after_rejection_clears_reason_and_deletes_old_file_after_commit(self):
        self.submit()
        self.record.approve(self.admin)
        self.record.reject(self.admin, 'Blurry scan')
        old = stored_files(self.media_root)
        with self.captureOnCommitCallbacks(execute=True):
            self.submit(data=JPEG, kind='jpeg')
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, Status.PENDING)
        self.assertEqual(self.record.rejection_reason, '')
        now = stored_files(self.media_root)
        self.assertEqual(len(now), 1)
        self.assertNotEqual(now, old)
        self.assertTrue(now[0].endswith('.jpg'))

    def test_old_file_is_kept_until_the_transaction_commits(self):
        self.submit()
        self.record.reject(self.admin, 'No')
        with self.captureOnCommitCallbacks(execute=False):
            self.submit(data=JPEG, kind='jpeg')
            self.assertEqual(len(stored_files(self.media_root)), 2)

    def test_failed_database_write_removes_the_new_file(self):
        with mock.patch.object(DoctorVerification, 'save', side_effect=DatabaseError):
            with self.assertRaises(DatabaseError):
                self.submit()
        self.assertEqual(stored_files(self.media_root), [])

    def test_approve_only_from_pending(self):
        with self.assertRaises(InvalidTransition):
            self.record.approve(self.admin)
        self.submit()
        self.record.approve(self.admin)
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, Status.APPROVED)
        self.assertEqual(self.record.reviewed_by, self.admin)
        self.assertIsNotNone(self.record.reviewed_at)

    def test_repeating_a_decision_fails_and_keeps_the_first_reviewer(self):
        other = make_admin('boss2')
        for first_decision in ('approve', 'reject'):
            record = DoctorVerification.objects.get(user=self.doctor)
            DoctorVerification.objects.filter(pk=record.pk).update(status=Status.NOT_SUBMITTED)
            record.refresh_from_db()
            self.submit(record)
            if first_decision == 'approve':
                record.approve(self.admin)
                expected = Status.APPROVED
            else:
                record.reject(self.admin, 'No')
                expected = Status.REJECTED
            first_time = DoctorVerification.objects.get(pk=record.pk).reviewed_at
            # A second admin's request still holds the record as it was when they loaded the list.
            stale = DoctorVerification.objects.get(pk=record.pk)
            stale.status = Status.PENDING
            with self.assertRaises(InvalidTransition):
                stale.approve(other)
            if expected == Status.REJECTED:
                stale.status = Status.PENDING
                with self.assertRaises(InvalidTransition):
                    stale.reject(other, 'x')
            saved = DoctorVerification.objects.get(pk=record.pk)
            self.assertEqual(saved.status, expected)
            self.assertEqual(saved.reviewed_by, self.admin)
            self.assertEqual(saved.reviewed_at, first_time)

    def test_reject_from_pending_records_reason_and_reviewer(self):
        self.submit()
        self.record.reject(self.admin, 'Name does not match')
        self.record.refresh_from_db()
        self.assertEqual(self.record.status, Status.REJECTED)
        self.assertEqual(self.record.rejection_reason, 'Name does not match')
        self.assertEqual(self.record.reviewed_by, self.admin)

    def test_reject_from_not_submitted_or_rejected_is_refused(self):
        with self.assertRaises(InvalidTransition):
            self.record.reject(self.admin, 'x')
        self.submit()
        self.record.reject(self.admin, 'x')
        with self.assertRaises(InvalidTransition):
            self.record.reject(self.admin, 'y')

    def test_revoking_clears_only_this_doctors_patients(self):
        other_doctor = make_doctor('doc2')
        mine = make_patient('mine', self.doctor)
        theirs = make_patient('theirs', other_doctor)
        self.submit()
        self.record.approve(self.admin)
        self.record.reject(self.admin, 'Licence expired')
        mine.refresh_from_db()
        theirs.refresh_from_db()
        self.assertIsNone(mine.registered_doctor)
        self.assertEqual(theirs.registered_doctor, other_doctor)

    def test_rejecting_a_pending_doctor_leaves_patients_alone(self):
        patient = make_patient('p', self.doctor)
        self.submit()
        self.record.reject(self.admin, 'x')
        patient.refresh_from_db()
        self.assertEqual(patient.registered_doctor, self.doctor)
