from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsDoctor
from .serializers import DoctorListSerializer, RegisterSerializer, UserProfileSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — public.

    Returns tokens alongside the profile so the app can either treat this
    as an immediate login, or just discard the tokens and send the user
    back to the login screen — whichever fits the existing UX better.
    """

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'profile': UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ProfileEmbeddingTokenSerializer(TokenObtainPairSerializer):
    """Same as the default JWT login serializer, but the response also
    includes the full profile so the app doesn't need a second request
    immediately after logging in."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data['profile'] = UserProfileSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    """POST /api/auth/login/ — public."""

    serializer_class = ProfileEmbeddingTokenSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    """GET /api/me/ — re-fetch the current profile (e.g. on app launch,
    so nothing sensitive needs to be cached on-device between sessions)."""

    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class DoctorListView(generics.ListAPIView):
    """GET /api/doctors/ — public.

    Deliberately unauthenticated: a brand-new disabled user needs to see
    this list *before* they have any credentials, during sign-up.
    """

    queryset = User.objects.filter(role=User.Role.DOCTOR).order_by('first_name')
    serializer_class = DoctorListSerializer
    permission_classes = [permissions.AllowAny]


class PatientListView(generics.ListAPIView):
    """GET /api/patients/ — the logged-in doctor's own patients only.

    No username in the URL — scoping comes entirely from request.user, so
    there's no way to even attempt asking for another doctor's list.
    """

    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get_queryset(self):
        return self.request.user.patients.all().order_by('first_name')