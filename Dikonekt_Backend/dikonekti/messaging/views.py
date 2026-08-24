from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .models import Message
from .serializers import CreateMessageSerializer, MessageSerializer


class MessageListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/messages/               — disabled user: their single
                                         thread with their own doctor.
    GET  /api/messages/?patient=<u>   — doctor: thread with that specific
                                         patient (required for doctors —
                                         a doctor may have several
                                         patients, so there's no single
                                         implicit thread the way there is
                                         for a disabled user).
    POST /api/messages/               — send a message. Disabled user only
                                         needs `body`; doctor also needs
                                         `recipient_username`.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMessageSerializer
        return MessageSerializer

    def get_queryset(self):
        user = self.request.user

        if user.role == 'doctor':
            patient_username = self.request.query_params.get('patient')
            if not patient_username:
                return Message.objects.none()
            return Message.objects.filter(
                Q(sender=user, recipient__username=patient_username)
                | Q(recipient=user, sender__username=patient_username)
            )

        doctor_id = user.registered_doctor_id
        if doctor_id is None:
            return Message.objects.none()
        return Message.objects.filter(
            Q(sender=user, recipient_id=doctor_id)
            | Q(recipient=user, sender_id=doctor_id)
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        return Response(
            MessageSerializer(message).data, status=status.HTTP_201_CREATED,
        )