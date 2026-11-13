from getpass import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = (
        'Create an admin account (role "admin") that can review doctors\' certificates. '
        'Asks for the password; it is never taken from the command line.'
    )

    def add_arguments(self, parser):
        parser.add_argument('username')

    def handle(self, *args, **options):
        username = options['username'].strip()
        if not username:
            raise CommandError('The username cannot be blank.')
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError(f'A user named "{username}" already exists.')

        password = getpass('Password: ')
        if password != getpass('Password (again): '):
            raise CommandError('The passwords do not match.')
        try:
            validate_password(password, user=User(username=username))
        except ValidationError as error:
            raise CommandError(' '.join(error.messages))

        User.objects.create_user(username=username, password=password, role=User.Role.ADMIN)
        self.stdout.write(self.style.SUCCESS(f'Admin "{username}" created.'))
