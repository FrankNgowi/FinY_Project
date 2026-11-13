from django.urls import path

from .verification_views import (
    AdminVerificationApproveView, AdminVerificationDocumentView, AdminVerificationListView,
    AdminVerificationRejectView, MyVerificationView,
)
from .views import DoctorListView, LoginView, MeView, PatientListView, RegisterView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('me/', MeView.as_view(), name='me'),
    path('me/verification/', MyVerificationView.as_view(), name='my-verification'),
    path('admin/verifications/', AdminVerificationListView.as_view(), name='admin-verification-list'),
    path('admin/verifications/<int:pk>/document/', AdminVerificationDocumentView.as_view(), name='admin-verification-document'),
    path('admin/verifications/<int:pk>/approve/', AdminVerificationApproveView.as_view(), name='admin-verification-approve'),
    path('admin/verifications/<int:pk>/reject/', AdminVerificationRejectView.as_view(), name='admin-verification-reject'),
    path('doctors/', DoctorListView.as_view(), name='doctor-list'),
    path('patients/', PatientListView.as_view(), name='patient-list'),
]