from django.contrib.auth.models import AbstractUser
from django.db import models


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

    role = models.CharField(max_length=10, choices=Role.choices)
    middle_name = models.CharField(max_length=150, blank=True, default='')
    area = models.CharField(max_length=100, blank=True, null=True)

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

    def __str__(self):
        return f'{self.username} ({self.role})'