from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from alerts.models import EmergencyAlert
from appointments.models import Appointment
from accounts.models import DoctorVerification, User
from accounts.test_helpers import (
    FAST_HASHER, MediaRootMixin, make_admin, make_doctor, make_patient,
)

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'boundary-tests'}}
Status = DoctorVerification.Status
LOCKED = [Status.NOT_SUBMITTED, Status.PENDING, Status.REJECTED]


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class RoleBoundaryTests(MediaRootMixin, TestCase):
    """Every role against every doctor-side endpoint. The doctor's verification status decides."""

    def setUp(self):
        super().setUp()
        self.doctor = make_doctor('doc')
        self.patient = make_patient('pat', self.doctor)
        self.admin = make_admin()
        self.alert = EmergencyAlert.objects.create(patient=self.patient, doctor=self.doctor, patient_area='x')
        self.appointment = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, requested_time='2030-01-01T10:00:00Z',
        )
        self.calls = {
            'patients': ('get', '/api/patients/', None),
            'alerts': ('get', '/api/alerts/', None),
            'acknowledge': ('patch', f'/api/alerts/{self.alert.pk}/acknowledge/', None),
            'appointments': ('get', '/api/appointments/', None),
            'appointment status': ('patch', f'/api/appointments/{self.appointment.pk}/status/', {'status': 'confirmed'}),
            'messages read': ('get', '/api/messages/?patient=pat', None),
            'messages send': ('post', '/api/messages/', {'body': 'hello', 'recipient_username': 'pat'}),
        }

    def call(self, user, name):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        method, url, body = self.calls[name]
        return getattr(client, method)(url, body, format='json')

    def set_status(self, status):
        DoctorVerification.objects.filter(user=self.doctor).update(status=status)
        self.doctor.refresh_from_db()

    def test_an_approved_doctor_gets_through_every_doctor_endpoint(self):
        for name in self.calls:
            self.assertIn(self.call(self.doctor, name).status_code, (200, 201), name)

    def test_a_doctor_who_is_not_approved_is_told_verification_is_required_everywhere(self):
        for status in LOCKED:
            self.set_status(status)
            for name in self.calls:
                response = self.call(self.doctor, name)
                self.assertEqual(response.status_code, 403, f'{status} {name}')
                self.assertEqual(response.json(), {
                    'detail': 'Your account is awaiting verification.',
                    'code': 'verification_required',
                }, f'{status} {name}')

    def test_an_unapproved_doctor_still_reaches_the_profile_and_verification_endpoints(self):
        self.set_status(Status.PENDING)
        client = APIClient()
        client.force_authenticate(self.doctor)
        self.assertEqual(client.get('/api/me/').status_code, 200)
        self.assertEqual(client.get('/api/me/verification/').status_code, 200)

    def test_approval_unlocks_the_same_doctor(self):
        self.set_status(Status.PENDING)
        self.assertEqual(self.call(self.doctor, 'patients').status_code, 403)
        self.set_status(Status.APPROVED)
        self.assertEqual(self.call(self.doctor, 'patients').status_code, 200)

    def test_revoking_an_approved_doctor_locks_them_out_at_once(self):
        self.assertEqual(self.call(self.doctor, 'alerts').status_code, 200)
        DoctorVerification.objects.get(user=self.doctor).reject(self.admin, 'Licence expired')
        self.doctor = User.objects.get(pk=self.doctor.pk)  # a request loads the user fresh
        self.assertEqual(self.call(self.doctor, 'alerts').status_code, 403)

    def test_an_admin_is_refused_on_every_doctor_and_patient_endpoint_and_sees_no_data(self):
        for name in self.calls:
            response = self.call(self.admin, name)
            self.assertEqual(response.status_code, 403, name)
            self.assertNotIn('verification_required', response.content.decode(), name)
            self.assertNotIn('pat', response.content.decode().replace('patient', ''), name)
        self.assertEqual(Appointment.objects.get(pk=self.appointment.pk).status, 'pending')
        self.assertFalse(EmergencyAlert.objects.get(pk=self.alert.pk).acknowledged)

    def test_an_admin_cannot_send_a_message_even_to_a_real_patient(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.post('/api/messages/', {'body': 'hi', 'recipient_username': 'pat'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_a_patient_keeps_their_own_endpoints_and_is_refused_the_doctor_only_ones(self):
        expected = {'patients': 403, 'alerts': 200, 'acknowledge': 403, 'appointments': 200,
                    'appointment status': 403, 'messages read': 200, 'messages send': 201}
        for name, code in expected.items():
            self.assertEqual(self.call(self.patient, name).status_code, code, name)

    def test_a_patient_is_unaffected_by_their_doctors_status(self):
        self.set_status(Status.PENDING)
        client = APIClient()
        client.force_authenticate(self.patient)
        self.assertEqual(client.get('/api/alerts/').status_code, 200)
        self.assertEqual(client.get('/api/appointments/').status_code, 200)

    def test_nobody_is_served_anything_when_not_signed_in(self):
        for name in self.calls:
            self.assertEqual(self.call(None, name).status_code, 401, name)


@override_settings(PASSWORD_HASHERS=FAST_HASHER, CACHES=LOCMEM)
class DoctorChoiceTests(MediaRootMixin, TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()  # registration is rate limited per IP; every test here registers

    def register(self, **fields):
        body = {
            'username': 'newpat', 'password': 'pw-Strong-123!', 'role': 'disabled', 'first_name': 'N',
            'area': 'Stone Town', 'phone_number': '+2547', 'disability_type': 'Vision', **fields,
        }
        return APIClient().post('/api/auth/register/', body, format='json')

    def test_the_public_doctor_list_has_approved_doctors_only(self):
        make_doctor('approved')
        for status in LOCKED:
            make_doctor(f'doc_{status}', status)
        names = [d['username'] for d in APIClient().get('/api/doctors/').json()]
        self.assertEqual(names, ['approved'])

    def test_a_patient_can_register_with_an_approved_doctor(self):
        make_doctor('approved')
        response = self.register(registered_doctor_username='approved')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(username='newpat').registered_doctor.username, 'approved')

    def test_registering_with_an_unapproved_doctor_fails_on_that_field(self):
        for status in LOCKED:
            make_doctor(f'doc_{status}', status)
            response = self.register(username=f'p_{status}', registered_doctor_username=f'doc_{status}')
            self.assertEqual(response.status_code, 400, status)
            self.assertIn('registered_doctor_username', response.json(), status)
            self.assertFalse(User.objects.filter(username=f'p_{status}').exists())

    def test_registering_without_a_doctor_still_works(self):
        self.assertEqual(self.register().status_code, 201)

    def test_registering_as_admin_is_rejected(self):
        response = APIClient().post('/api/auth/register/', {
            'username': 'sneaky', 'password': 'pw-Strong-123!', 'role': 'admin', 'first_name': 'S',
            'area': 'x', 'phone_number': '+2547',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='sneaky').exists())

    def test_revoked_doctors_leave_the_public_list(self):
        doctor = make_doctor('gone')
        DoctorVerification.objects.get(user=doctor).reject(make_admin(), 'x')
        self.assertEqual(APIClient().get('/api/doctors/').json(), [])
