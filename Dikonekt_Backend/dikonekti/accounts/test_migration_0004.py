from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [("accounts", "0003_doctor_verification")]
AFTER = [("accounts", "0004_approve_existing_doctors")]


class ApproveExistingDoctorsTests(TransactionTestCase):
    def setUp(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(BEFORE)
        self.old_apps = self.executor.loader.project_state(BEFORE).apps
        self.User = self.old_apps.get_model("accounts", "User")
        self.Verification = self.old_apps.get_model("accounts", "DoctorVerification")

    def tearDown(self):
        self.Verification.objects.all().delete()
        self.User.objects.all().delete()
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def migrate_forward(self):
        executor = MigrationExecutor(connection)
        executor.migrate(AFTER)
        return executor.loader.project_state(AFTER).apps

    def user(self, name, role):
        return self.User.objects.create(username=name, role=role, password="x")

    def test_every_existing_doctor_becomes_approved_and_nobody_else_gets_a_record(self):
        doctor = self.user("d1", "doctor")
        self.user("d2", "doctor")
        patient = self.user("p", "disabled")
        apps = self.migrate_forward()
        Verification = apps.get_model("accounts", "DoctorVerification")
        self.assertEqual(Verification.objects.count(), 2)
        self.assertEqual(set(Verification.objects.values_list("status", flat=True)), {"approved"})
        self.assertFalse(Verification.objects.filter(user_id=patient.pk).exists())
        self.assertTrue(Verification.objects.filter(user_id=doctor.pk).exists())

    def test_a_doctor_who_already_has_a_record_keeps_its_status(self):
        doctor = self.user("d1", "doctor")
        self.Verification.objects.create(user=doctor, status="rejected")
        apps = self.migrate_forward()
        Verification = apps.get_model("accounts", "DoctorVerification")
        self.assertEqual(Verification.objects.get(user_id=doctor.pk).status, "rejected")

    def test_running_the_step_again_creates_no_duplicates(self):
        self.user("d1", "doctor")
        self.migrate_forward()
        executor = MigrationExecutor(connection)
        executor.migrate(BEFORE)
        executor.loader.build_graph()
        executor = MigrationExecutor(connection)
        apps = executor.loader.project_state(BEFORE).apps
        before = apps.get_model("accounts", "DoctorVerification").objects.count()
        executor.migrate(AFTER)
        after = executor.loader.project_state(AFTER).apps.get_model("accounts", "DoctorVerification").objects.count()
        self.assertEqual((before, after), (1, 1))

    def test_a_database_with_no_doctors_migrates_cleanly(self):
        apps = self.migrate_forward()
        self.assertEqual(apps.get_model("accounts", "DoctorVerification").objects.count(), 0)
