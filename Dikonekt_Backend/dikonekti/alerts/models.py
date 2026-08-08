from django.conf import settings
from django.db import models


class EmergencyAlert(models.Model):
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_alerts',
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='received_alerts',
    )

    # Snapshotted from the patient at send-time, so the record still makes
    # sense even if the patient later edits their profile.
    patient_area = models.CharField(max_length=100, blank=True, null=True)
    disability_type = models.CharField(max_length=100, blank=True, null=True)

    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    location_error = models.CharField(max_length=255, blank=True, null=True)

    timestamp = models.DateTimeField(auto_now_add=True)
    acknowledged = models.BooleanField(default=False)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'Alert from {self.patient.username} at {self.timestamp:%Y-%m-%d %H:%M}'