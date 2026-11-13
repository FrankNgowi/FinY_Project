from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from messaging.models import MESSAGE_BODY_MAX_LENGTH, Message

TOO_LONG = "Message is too long (max 2000 characters)."


class MessageLimitTests(APITestCase):
    def setUp(self):
        self.doctor = User.objects.create_user(username="dr1", password="x", role="doctor")
        self.patient = User.objects.create_user(
            username="p1", password="x", role="disabled", registered_doctor=self.doctor
        )

    def send_as_patient(self, body):
        client = APIClient()
        client.force_authenticate(self.patient)
        return client.post("/api/messages/", {"body": body}, format="json")

    def send_as_doctor(self, body):
        client = APIClient()
        client.force_authenticate(self.doctor)
        return client.post("/api/messages/", {"body": body, "recipient_username": "p1"}, format="json")

    def test_the_limit_is_2000_and_lives_on_the_column(self):
        self.assertEqual(MESSAGE_BODY_MAX_LENGTH, 2000)
        self.assertEqual(Message._meta.get_field("body").max_length, 2000)

    def test_a_2000_character_message_is_accepted_from_a_patient_and_a_doctor(self):
        self.assertEqual(self.send_as_patient("a" * 2000).status_code, 201)
        self.assertEqual(self.send_as_doctor("b" * 2000).status_code, 201)
        self.assertEqual(Message.objects.count(), 2)

    def test_a_2001_character_message_is_rejected_with_the_exact_message_and_not_stored(self):
        for send in (self.send_as_patient, self.send_as_doctor):
            response = send("a" * 2001)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"body": [TOO_LONG]})
        self.assertEqual(Message.objects.count(), 0)

    def test_surrounding_whitespace_is_trimmed_before_counting(self):
        response = self.send_as_patient("   " + "a" * 2000 + "   ")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(Message.objects.get().body), 2000)

    def test_a_message_of_only_spaces_is_still_reported_as_empty(self):
        response = self.send_as_patient("     ")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"body": ["Message cannot be empty."]})

    def test_a_missing_body_is_still_a_clean_400(self):
        client = APIClient()
        client.force_authenticate(self.patient)
        self.assertEqual(client.post("/api/messages/", {}, format="json").status_code, 400)

    def test_a_two_megabyte_body_is_rejected(self):
        response = self.send_as_patient("a" * 2_000_000)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"body": [TOO_LONG]})
        self.assertEqual(Message.objects.count(), 0)

    def test_characters_are_counted_not_bytes(self):
        self.assertEqual(self.send_as_patient("😀" * 2000).status_code, 201)
        self.assertEqual(self.send_as_patient("😀" * 2001).status_code, 400)

    def test_reading_a_thread_with_a_maximum_length_message_still_works(self):
        self.send_as_patient("a" * 2000)
        client = APIClient()
        client.force_authenticate(self.patient)
        response = client.get("/api/messages/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()[0]["body"]), 2000)
