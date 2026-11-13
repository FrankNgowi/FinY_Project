from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import DoctorVerification, User
from accounts.test_helpers import FAST_HASHER, make_admin, make_doctor, make_patient
from alerts.models import EmergencyAlert

Status = DoctorVerification.Status


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class AlertRoutingTests(TestCase):
    def send(self, patient):
        client = APIClient()
        client.force_authenticate(patient)
        response = client.post('/api/alerts/', {'latitude': 1.0, 'longitude': 2.0}, format='json')
        self.assertEqual(response.status_code, 201)
        return EmergencyAlert.objects.latest('pk')

    def test_an_alert_goes_to_the_patients_approved_doctor(self):
        doctor = make_doctor('doc')
        self.assertEqual(self.send(make_patient('pat', doctor)).doctor, doctor)

    def test_after_revocation_the_next_alert_is_saved_without_a_doctor(self):
        doctor = make_doctor('doc')
        patient = make_patient('pat', doctor)
        DoctorVerification.objects.get(user=doctor).reject(make_admin(), 'Licence expired')
        patient.refresh_from_db()
        self.assertIsNone(self.send(patient).doctor)

    def test_a_patient_still_pointing_at_an_unapproved_doctor_gets_no_routing(self):
        for status in (Status.NOT_SUBMITTED, Status.PENDING, Status.REJECTED):
            doctor = make_doctor(f'doc_{status}', status)
            patient = make_patient(f'pat_{status}', doctor)
            self.assertIsNone(self.send(patient).doctor, status)

    def test_a_revoked_doctor_cannot_see_alerts_sent_before_the_revocation(self):
        doctor = make_doctor('doc')
        patient = make_patient('pat', doctor)
        self.send(patient)
        DoctorVerification.objects.get(user=doctor).reject(make_admin(), 'x')
        client = APIClient()
        client.force_authenticate(User.objects.get(pk=doctor.pk))
        self.assertEqual(client.get('/api/alerts/').status_code, 403)
