from django.db import DataError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [("messaging", "0001_initial")]
AFTER = [("messaging", "0002_message_body_max_length")]


def column():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT data_type, character_maximum_length FROM information_schema.columns "
            "WHERE table_name = 'messaging_message' AND column_name = 'body'"
        )
        return cursor.fetchone()


class MessageBodyMigrationTests(TransactionTestCase):
    def setUp(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(BEFORE)
        self.old_apps = self.executor.loader.project_state(BEFORE).apps
        user = self.old_apps.get_model("accounts", "User")
        self.sender = user.objects.create(username="s", role="disabled", password="x")
        self.recipient = user.objects.create(username="r", role="doctor", password="x")

    def tearDown(self):
        # Leave the database fully migrated for the next test: oversized rows would stop that.
        self.old_apps.get_model("messaging", "Message").objects.all().delete()
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def add_message(self, body):
        return self.old_apps.get_model("messaging", "Message").objects.create(
            sender=self.sender, recipient=self.recipient, body=body
        )

    def migrate_forward(self):
        executor = MigrationExecutor(connection)
        executor.migrate(AFTER)
        return executor.loader.project_state(AFTER).apps

    def test_it_aborts_with_the_count_and_changes_nothing_when_a_body_is_too_long(self):
        self.add_message("a" * 2001)
        self.add_message("b" * 3000)
        self.add_message("short")
        with self.assertRaises(RuntimeError) as ctx:
            self.migrate_forward()
        message = str(ctx.exception)
        self.assertIn("2", message)  # two offending rows
        self.assertIn("2000", message)
        self.assertEqual(column()[0], "text")
        self.assertEqual(self.old_apps.get_model("messaging", "Message").objects.count(), 3)

    def test_a_body_of_exactly_2000_characters_does_not_block_the_migration(self):
        self.add_message("a" * 2000)
        self.migrate_forward()
        self.assertEqual(column(), ("character varying", 2000))

    def test_after_migrating_the_database_itself_refuses_longer_bodies(self):
        new_apps = self.migrate_forward()
        message = new_apps.get_model("messaging", "Message")
        with self.assertRaises(DataError), transaction.atomic():
            message.objects.create(sender_id=self.sender.id, recipient_id=self.recipient.id, body="a" * 2001)

    def test_existing_short_messages_survive_the_migration_unchanged(self):
        self.add_message("hello")
        new_apps = self.migrate_forward()
        self.assertEqual(new_apps.get_model("messaging", "Message").objects.get().body, "hello")

    def test_the_migration_can_be_reversed(self):
        self.migrate_forward()
        executor = MigrationExecutor(connection)
        executor.migrate(BEFORE)
        self.assertEqual(column()[0], "text")
