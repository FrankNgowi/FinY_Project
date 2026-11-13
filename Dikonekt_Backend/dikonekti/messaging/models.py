from django.conf import settings
from django.db import models


# The one place the limit is defined; the serializer and the migration check import it.
MESSAGE_BODY_MAX_LENGTH = 2000


class Message(models.Model):
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages',
    )
    body = models.CharField(max_length=MESSAGE_BODY_MAX_LENGTH)
    timestamp = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.sender.username} -> {self.recipient.username}: {self.body[:30]}'