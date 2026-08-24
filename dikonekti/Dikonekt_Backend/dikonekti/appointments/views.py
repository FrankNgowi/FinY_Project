from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Appointment
from .permissions import IsDisabledUser, IsOwningDoctor
from .serializers import (
    AppointmentSerializer,
    CreateAppointmentSerializer,
    UpdateAppointmentStatusSerializer,
)


class AppointmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/appointments/ — doctor: appointments routed to them.
                              disabled user: appointments they requested.
    POST /api/appointments/ — disabled user only.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateAppointmentSerializer
        return AppointmentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsDisabledUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'doctor':
            return user.appointments.all()
        return user.requested_appointments.all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()
        return Response(
            AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED,
        )


class UpdateAppointmentStatusView(APIView):
    """PATCH /api/appointments/<id>/status/ — doctor-only, and only for
    appointments routed to that specific doctor."""

    permission_classes = [permissions.IsAuthenticated, IsOwningDoctor]

    def get_object(self):
        appointment = generics.get_object_or_404(Appointment, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, appointment)
        return appointment

    def patch(self, request, pk):
        appointment = self.get_object()
        serializer = UpdateAppointmentStatusSerializer(
            appointment, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AppointmentSerializer(appointment).data)