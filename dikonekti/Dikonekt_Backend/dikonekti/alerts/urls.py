from django.urls import path

from .views import AcknowledgeAlertView, AlertListCreateView

urlpatterns = [
    path('alerts/', AlertListCreateView.as_view(), name='alert-list-create'),
    path(
        'alerts/<int:pk>/acknowledge/',
        AcknowledgeAlertView.as_view(),
        name='alert-acknowledge',
    ),
]