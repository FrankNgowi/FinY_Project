from django.urls import path

from .views import DoctorListView, LoginView, MeView, PatientListView, RegisterView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('me/', MeView.as_view(), name='me'),
    path('doctors/', DoctorListView.as_view(), name='doctor-list'),
    path('patients/', PatientListView.as_view(), name='patient-list'),
]