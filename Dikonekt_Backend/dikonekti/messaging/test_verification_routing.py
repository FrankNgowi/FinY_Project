from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import DoctorVerification, User
from accounts.test_helpers import FAST_HASHER, make_admin, make_doctor, make_patient
from messaging.models import Message

Status = DoctorVerification.Status


@override_settings(PASSWORD_HASHERS=FAST_HASHER)
class MessageRoutingTests(TestCase):
    def send_as(self, user, body):
        client = APIClient()
        client.force_authenticate(user)
        return client.post('/api/messages/', body, format='json')

    def test_a_patient_can_message_their_approved_doctor(self):
        doctor = make_doctor('doc')
        response = self.send_as(make_patient('pat', doctor), {'body': 'hello'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Message.objects.get().recipient, doctor)

    def test_a_patient_cannot_message_a_doctor_who_is_not_approved(self):
        for status in (Status.NOT_SUBMITTED, Status.PENDING, Status.REJECTED):
            doctor = make_doctor(f'doc_{status}', status)
            patient = make_patient(f'pat_{status}', doctor)
            self.assertEqual(self.send_as(patient, {'body': 'hello'}).status_code, 400, status)
        self.assertEqual(Message.objects.count(), 0)

    def test_after_revocation_the_patient_has_no_doctor_to_message(self):
        doctor = make_doctor('doc')
        patient = make_patient('pat', doctor)
        DoctorVerification.objects.get(user=doctor).reject(make_admin(), 'x')
        patient.refresh_from_db()
        self.assertEqual(self.send_as(patient, {'body': 'hello'}).status_code, 400)

    def test_a_patient_reads_no_thread_with_a_doctor_who_is_not_approved(self):
        doctor = make_doctor('doc')
        patient = make_patient('pat', doctor)
        Message.objects.create(sender=patient, recipient=doctor, body='old')
        DoctorVerification.objects.filter(user=doctor).update(status=Status.REJECTED)
        client = APIClient()
        client.force_authenticate(User.objects.get(pk=patient.pk))
        self.assertEqual(client.get('/api/messages/').json(), [])
