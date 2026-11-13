"""Shared builders for the verification tests."""
import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from accounts.models import DoctorVerification, User

PDF = b'%PDF-1.4\n%test\n' + b'0' * 1024
PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 1024
JPEG = b'\xff\xd8\xff\xe0' + b'0' * 1024
PASSWORD = 'pw-Strong-123!'

# Password hashing is deliberately slow; these tests create many users.
FAST_HASHER = ['django.contrib.auth.hashers.MD5PasswordHasher']


def upload(data=PDF, name='certificate.pdf', content_type='application/pdf'):
    return SimpleUploadedFile(name, data, content_type)


def make_user(username, role, **extra):
    fields = {'area': 'Stone Town', 'phone_number': '+254700000001', 'first_name': username.title()}
    if role == User.Role.DOCTOR:
        fields['specialization'] = 'Vision'
    if role == User.Role.DISABLED:
        fields['disability_type'] = 'Vision'
    fields.update(extra)
    return User.objects.create_user(username=username, password=PASSWORD, role=role, **fields)


def make_doctor(username='doc', status=DoctorVerification.Status.APPROVED):
    user = make_user(username, User.Role.DOCTOR)
    DoctorVerification.objects.create(user=user, status=status)
    return user


def make_admin(username='boss'):
    return make_user(username, User.Role.ADMIN)


def make_patient(username='pat', doctor=None):
    return make_user(username, User.Role.DISABLED, registered_doctor=doctor)


def stored_files(root):
    found = []
    for folder, _dirs, names in os.walk(root):
        found.extend(os.path.join(folder, name) for name in names)
    return found


class MediaRootMixin:
    """Point MEDIA_ROOT at a private temporary folder for the test."""

    def setUp(self):
        super().setUp()
        self.media_root = tempfile.mkdtemp(prefix='dik-media-')
        os.chmod(self.media_root, 0o700)
        override = override_settings(MEDIA_ROOT=self.media_root)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
