from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmergencyAlert
from .permissions import IsDisabledUser, IsOwningDoctor
from .serializers import CreateEmergencyAlertSerializer, EmergencyAlertSerializer


class AlertListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/alerts/ — doctor: alerts routed to them.
                        disabled user: alerts they themselves sent.
    POST /api/alerts/ — disabled user only. The server resolves patient,
                        doctor, area, and disability type from
                        request.user, so the client only ever sends
                        latitude/longitude/location_error.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateEmergencyAlertSerializer
        return EmergencyAlertSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsDisabledUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'doctor':
            return user.received_alerts.all()
        return user.sent_alerts.all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alert = serializer.save()
        return Response(
            EmergencyAlertSerializer(alert).data, status=status.HTTP_201_CREATED,
        )


class AcknowledgeAlertView(APIView):
    """PATCH /api/alerts/<id>/acknowledge/ — doctor-only, and only for
    alerts routed to that specific doctor (enforced by IsOwningDoctor's
    object-level check, not just the doctor role in general)."""

    permission_classes = [permissions.IsAuthenticated, IsOwningDoctor]

    def get_object(self):
        alert = generics.get_object_or_404(EmergencyAlert, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, alert)
        return alert

    def patch(self, request, pk):
        alert = self.get_object()
        alert.acknowledged = True
        alert.save(update_fields=['acknowledged'])
        return Response(EmergencyAlertSerializer(alert).data)