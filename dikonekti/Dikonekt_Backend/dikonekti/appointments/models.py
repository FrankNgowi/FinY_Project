from django.conf import settings
from django.db import models


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        DECLINED = 'declined', 'Declined'

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='requested_appointments',
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='appointments',
    )
    requested_time = models.DateTimeField()
    reason = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['requested_time']

    def __str__(self):
        return f'{self.patient.username} with {self.doctor} at {self.requested_time}'