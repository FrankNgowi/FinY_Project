from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from .files import EXTENSIONS, delete_after_commit, document_path, private_storage


class User(AbstractUser):
    """Custom user supporting both roles the app needs.

    Doctor-only fields (specialization) and disabled-user-only fields
    (area, disability_type, registered_doctor) all live on one model,
    matching what the Flutter app's UserAccount already assumes — Django
    doesn't mind the unused nulls on whichever role doesn't use a field.
    """

    class Role(models.TextChoices):
        DOCTOR = 'doctor', 'Doctor'
        DISABLED = 'disabled', 'Disabled User'
        # Reviews doctors' certificates. Never created through public registration.
        ADMIN = 'admin', 'Admin'

    role = models.CharField(max_length=10, choices=Role.choices)
    middle_name = models.CharField(max_length=150, blank=True, default='')
    area = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    # Disabled-user-only. Free text: if the app's "Others" option was
    # picked, the resolved custom text is stored directly here rather than
    # the literal word "Others".
    disability_type = models.CharField(max_length=100, blank=True, null=True)

    registered_doctor = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='patients',
        limit_choices_to={'role': Role.DOCTOR},
    )

    # Doctor-only.
    specialization = models.CharField(max_length=100, blank=True, null=True)

    @property
    def is_doctor(self):
        return self.role == self.Role.DOCTOR

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def verification_status(self):
        """A doctor's verification status; None for other roles. A doctor with no record yet
        (for example one created in Django admin) counts as not submitted."""
        if not self.is_doctor:
            return None
        try:
            return self.verification.status
        except DoctorVerification.DoesNotExist:
            return DoctorVerification.Status.NOT_SUBMITTED

    @property
    def approved_registered_doctor(self):
        """The doctor this patient chose, only if that doctor is currently approved. Alerts,
        appointments and messages are routed through this, never through registered_doctor."""
        doctor = self.registered_doctor
        if doctor is not None and doctor.verification_status == DoctorVerification.Status.APPROVED:
            return doctor
        return None

    def __str__(self):
        return f'{self.username} ({self.role})'


class InvalidTransition(Exception):
    """The verification record is not in a state that allows the requested change."""


class DoctorVerification(models.Model):
    class Status(models.TextChoices):
        NOT_SUBMITTED = 'not_submitted', 'Not submitted'
        PENDING = 'pending', 'Pending review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='verification',
        limit_choices_to={'role': User.Role.DOCTOR},
    )
    status = models.CharField(max_length=13, choices=Status.choices, default=Status.NOT_SUBMITTED)
    document = models.FileField(storage=private_storage(), upload_to=document_path, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, default='')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['submitted_at', 'pk']

    @classmethod
    def for_user(cls, user):
        record, _created = cls.objects.get_or_create(user=user)
        return record

    # Every change below re-reads the row under a lock, so two requests acting on the same
    # record (two admins, or two uploads by one doctor) cannot both pass the status check.
    def _locked(self):
        return type(self).objects.select_for_update().get(pk=self.pk)

    def submit(self, uploaded, kind):
        with transaction.atomic():
            row = self._locked()
            if row.status not in (self.Status.NOT_SUBMITTED, self.Status.REJECTED):
                raise InvalidTransition('A document was already submitted.')
            old_name = row.document.name
            row.document.save(f'upload.{EXTENSIONS[kind]}', uploaded, save=False)
            new_name = row.document.name
            try:
                row.status = self.Status.PENDING
                row.submitted_at = timezone.now()
                row.rejection_reason = ''
                row.reviewed_by = None
                row.reviewed_at = None
                row.save()
            except Exception:
                private_storage().delete(new_name)
                raise
            if old_name:
                delete_after_commit(old_name)
        self.refresh_from_db()

    def approve(self, admin):
        with transaction.atomic():
            row = self._locked()
            if row.status != self.Status.PENDING:
                raise InvalidTransition('This request is not waiting for review.')
            row.status = self.Status.APPROVED
            row.rejection_reason = ''
            row.reviewed_by = admin
            row.reviewed_at = timezone.now()
            row.save()
        self.refresh_from_db()

    def reject(self, admin, reason):
        """Reject a pending request, or revoke an approved one (which also removes the doctor
        from every patient who had chosen them, so no alert is routed to a locked-out doctor)."""
        with transaction.atomic():
            row = self._locked()
            if row.status not in (self.Status.PENDING, self.Status.APPROVED):
                raise InvalidTransition('This request cannot be rejected.')
            was_approved = row.status == self.Status.APPROVED
            row.status = self.Status.REJECTED
            row.rejection_reason = reason
            row.reviewed_by = admin
            row.reviewed_at = timezone.now()
            row.save()
            if was_approved:
                User.objects.filter(registered_doctor_id=row.user_id).update(registered_doctor=None)
        self.refresh_from_db()

    def __str__(self):
        return f'{self.user.username}: {self.status}'