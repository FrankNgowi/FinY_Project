from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
    path('api/', include('alerts.urls')),
    path('api/', include('appointments.urls')),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]