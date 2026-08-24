from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


def _display_name(user) -> str:
    parts = [user.first_name, user.middle_name, user.last_name]
    name = ' '.join(p for p in parts if p and p.strip()) or user.username
    if user.role == User.Role.DOCTOR and not name.lower().startswith('dr'):
        return f'Dr. {name}'
    return name


class DoctorSummarySerializer(serializers.ModelSerializer):
    """Minimal doctor info embedded in a disabled user's own profile, so
    the app's 'My Doctor' screen never needs a second request."""

    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['username', 'display_name', 'email', 'area', 'specialization', 'phone_number']

    def get_display_name(self, obj):
        return _display_name(obj)


class DoctorListSerializer(serializers.ModelSerializer):
    """Public list used to populate the sign-up 'Registered Doctor'
    dropdown. Deliberately exposes no sensitive fields."""

    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['username', 'role', 'display_name', 'specialization', 'area']

    def get_display_name(self, obj):
        return _display_name(obj)


class UserProfileSerializer(serializers.ModelSerializer):
    """Full profile returned after login, from /api/me/, after
    registration, and in the doctor's patient list."""

    display_name = serializers.SerializerMethodField()
    registered_doctor = DoctorSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'role', 'display_name', 'first_name', 'middle_name',
            'last_name', 'email', 'phone_number', 'area', 'disability_type',
            'specialization', 'registered_doctor',
        ]

    def get_display_name(self, obj):
        return _display_name(obj)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    registered_doctor_username = serializers.CharField(
        write_only=True, required=False, allow_blank=True, allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            'username', 'password', 'role', 'first_name', 'middle_name',
            'last_name', 'email', 'phone_number', 'area', 'disability_type',
            'specialization', 'registered_doctor_username',
        ]

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_role(self, value):
        if value not in (User.Role.DOCTOR, User.Role.DISABLED):
            raise serializers.ValidationError('Role must be "doctor" or "disabled".')
        return value

    def validate(self, attrs):
        role = attrs.get('role')

        if not attrs.get('area'):
            raise serializers.ValidationError({'area': 'Area is required.'})

        if not attrs.get('phone_number'):
            raise serializers.ValidationError(
                {'phone_number': 'A phone number is required.'}
            )

        if role == User.Role.DOCTOR:
            if not attrs.get('specialization'):
                raise serializers.ValidationError(
                    {'specialization': 'Specialization is required for doctors.'}
                )
            attrs.pop('registered_doctor_username', None)
            attrs['disability_type'] = None
        else:
            if not attrs.get('disability_type'):
                raise serializers.ValidationError(
                    {'disability_type': 'Disability type is required.'}
                )
            attrs['specialization'] = None

            doctor_username = attrs.pop('registered_doctor_username', None)
            if doctor_username:
                try:
                    attrs['registered_doctor'] = User.objects.get(
                        username=doctor_username, role=User.Role.DOCTOR,
                    )
                except User.DoesNotExist:
                    raise serializers.ValidationError(
                        {'registered_doctor_username': 'Selected doctor was not found.'}
                    )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user