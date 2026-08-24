from rest_framework import serializers

from .models import Appointment


class AppointmentSerializer(serializers.ModelSerializer):
    """Used for listing to either the doctor or the patient who requested
    it, and for the response after creating/updating one."""

    patient_username = serializers.CharField(source='patient.username', read_only=True)
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient_username', 'patient_name', 'requested_time',
            'reason', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']

    def get_patient_name(self, obj):
        parts = [obj.patient.first_name, obj.patient.middle_name, obj.patient.last_name]
        return ' '.join(p for p in parts if p and p.strip()) or obj.patient.username


class CreateAppointmentSerializer(serializers.ModelSerializer):
    """Patient only sends when + why — the doctor is resolved server-side
    from the patient's own registered_doctor, same pattern as alerts."""

    class Meta:
        model = Appointment
        fields = ['requested_time', 'reason']

    def validate(self, attrs):
        patient = self.context['request'].user
        if patient.registered_doctor_id is None:
            raise serializers.ValidationError(
                'You need a registered doctor before requesting an '
                'appointment. Please add one from your profile.'
            )
        return attrs

    def create(self, validated_data):
        patient = self.context['request'].user
        return Appointment.objects.create(
            patient=patient,
            doctor=patient.registered_doctor,
            **validated_data,
        )


class UpdateAppointmentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['status']

    def validate_status(self, value):
        if value not in (Appointment.Status.CONFIRMED, Appointment.Status.DECLINED):
            raise serializers.ValidationError('Status must be confirmed or declined.')
        return value