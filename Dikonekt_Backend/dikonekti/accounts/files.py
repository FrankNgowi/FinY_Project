"""Rules for the certificate files doctors upload.

Everything that touches the files on disk is here. Files live in a private folder
(settings.MEDIA_ROOT), under random names, and are never served from a public URL.
"""
import os
import uuid

from django.core.files.storage import FileSystemStorage
from django.db import transaction

MAX_FILE_BYTES = 5 * 1024 * 1024
# A 5 MB file plus the multipart framing. A request that declares more is refused unread.
MAX_BODY_BYTES = 6 * 1024 * 1024

EXTENSIONS = {'pdf': 'pdf', 'png': 'png', 'jpeg': 'jpg'}
CONTENT_TYPES = {'pdf': 'application/pdf', 'png': 'image/png', 'jpeg': 'image/jpeg'}

_SIGNATURES = (
    (b'%PDF-', 'pdf'),
    (b'\x89PNG\r\n\x1a\n', 'png'),
    (b'\xff\xd8\xff', 'jpeg'),
)


class InvalidDocument(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def sniff(head: bytes):
    """The file kind named by its first bytes, or None. The name and declared type are ignored."""
    for signature, kind in _SIGNATURES:
        if head.startswith(signature):
            return kind
    return None


def validate_document(uploaded) -> str:
    """Return the kind of an uploaded file ('pdf', 'png' or 'jpeg'), or raise InvalidDocument."""
    if uploaded.size == 0:
        raise InvalidDocument('The file is empty.')
    if uploaded.size > MAX_FILE_BYTES:
        raise InvalidDocument('The file is larger than 5 MB.')
    uploaded.seek(0)
    head = uploaded.read(8)
    uploaded.seek(0)
    kind = sniff(head)
    if kind is None:
        raise InvalidDocument('Only PDF, JPEG or PNG files are accepted.')
    return kind


def content_type_for(kind: str) -> str:
    return CONTENT_TYPES[kind]


def kind_of_stored_file(name: str):
    """Re-check a stored file's kind from its first bytes (used when serving it)."""
    with private_storage().open(name, 'rb') as handle:
        return sniff(handle.read(8))


# FileSystemStorage with no location follows settings.MEDIA_ROOT, including a test override.
_storage = FileSystemStorage()


def private_storage():
    return _storage


def document_path(instance, filename):
    """upload_to for DoctorVerification.document: a random name, never the client's."""
    ext = os.path.splitext(filename)[1].lstrip('.').lower()
    return f'verification/{uuid.uuid4().hex}.{ext}'


def delete_after_commit(name: str):
    """Delete a stored file once the surrounding transaction has committed."""
    if name:
        transaction.on_commit(lambda: private_storage().delete(name))
