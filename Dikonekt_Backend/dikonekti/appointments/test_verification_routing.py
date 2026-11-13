from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import DoctorVerification
from accounts.test_helpers import FAST_HASHER, make_admin, make_doctor, make_patient
from appointments.models import Appointment

Status = DoctorVerification.Status


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class AppointmentRoutingTests(TestCase):
    def request(self, patient):
        client = APIClient()
        client.force_authenticate(patient)
        return client.post(
            '/api/appointments/', {'requested_time': '2030-01-01T10:00:00Z', 'reason': 'checkup'}, format='json',
        )

    def test_a_request_goes_to_the_patients_approved_doctor(self):
        doctor = make_doctor('doc')
        self.assertEqual(self.request(make_patient('pat', doctor)).status_code, 201)
        self.assertEqual(Appointment.objects.get().doctor, doctor)

    def test_after_revocation_the_patient_must_choose_a_doctor_again(self):
        doctor = make_doctor('doc')
        patient = make_patient('pat', doctor)
        DoctorVerification.objects.get(user=doctor).reject(make_admin(), 'x')
        patient.refresh_from_db()
        response = self.request(patient)
        self.assertEqual(response.status_code, 400)
        self.assertIn('registered doctor', str(response.json()))

    def test_a_patient_still_pointing_at_an_unapproved_doctor_cannot_book_with_them(self):
        for status in (Status.NOT_SUBMITTED, Status.PENDING, Status.REJECTED):
            doctor = make_doctor(f'doc_{status}', status)
            patient = make_patient(f'pat_{status}', doctor)
            self.assertEqual(self.request(patient).status_code, 400, status)
        self.assertEqual(Appointment.objects.count(), 0)
