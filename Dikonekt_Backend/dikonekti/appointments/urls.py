from django.urls import path

from .views import AppointmentListCreateView, UpdateAppointmentStatusView

urlpatterns = [
    path(
        'appointments/',
        AppointmentListCreateView.as_view(),
        name='appointment-list-create',
    ),
    path(
        'appointments/<int:pk>/status/',
        UpdateAppointmentStatusView.as_view(),
        name='appointment-status',
    ),
]