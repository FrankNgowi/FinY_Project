from rest_framework import serializers

from .models import EmergencyAlert


class EmergencyAlertSerializer(serializers.ModelSerializer):
    """Used for listing alerts to either a doctor or the patient who sent
    them, and for the response after creating one."""

    patient_username = serializers.CharField(source='patient.username', read_only=True)
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = EmergencyAlert
        fields = [
            'id', 'patient_username', 'patient_name', 'patient_area',
            'patient_phone_number', 'disability_type', 'latitude',
            'longitude', 'location_error', 'timestamp', 'acknowledged',
        ]
        read_only_fields = ['id', 'timestamp', 'acknowledged']

    def get_patient_name(self, obj):
        parts = [obj.patient.first_name, obj.patient.middle_name, obj.patient.last_name]
        return ' '.join(p for p in parts if p and p.strip()) or obj.patient.username


class CreateEmergencyAlertSerializer(serializers.ModelSerializer):
    """Only accepts what the client actually knows (GPS coordinates / a
    location error). Patient, doctor, area, and disability type are all
    resolved server-side from request.user — the client cannot spoof who
    the alert is "from" or which doctor it's routed to.
    """

    class Meta:
        model = EmergencyAlert
        fields = ['latitude', 'longitude', 'location_error']

    def validate(self, attrs):
        patient = self.context['request'].user
        if not patient.phone_number:
            raise serializers.ValidationError(
                'Please add a phone number to your profile before sending '
                'an emergency alert — your doctor needs a way to reach you.'
            )
        return attrs

    def create(self, validated_data):
        patient = self.context['request'].user
        return EmergencyAlert.objects.create(
            patient=patient,
            doctor=patient.registered_doctor,
            patient_area=patient.area,
            patient_phone_number=patient.phone_number,
            disability_type=patient.disability_type,
            **validated_data,
        )