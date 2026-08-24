from rest_framework import serializers

from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    recipient_username = serializers.CharField(
        source='recipient.username', read_only=True,
    )

    class Meta:
        model = Message
        fields = [
            'id', 'sender_username', 'recipient_username', 'body',
            'timestamp', 'read',
        ]
        read_only_fields = ['id', 'timestamp', 'read']


class CreateMessageSerializer(serializers.ModelSerializer):
    """
    Disabled user: only sends `body` — the recipient is always their own
    registered doctor, resolved server-side.
    Doctor: must also send `recipient_username`, and it must actually be
    one of their own patients — a doctor cannot message someone who isn't
    registered with them.
    """

    recipient_username = serializers.CharField(
        write_only=True, required=False, allow_blank=True,
    )

    class Meta:
        model = Message
        fields = ['body', 'recipient_username']

    def validate(self, attrs):
        sender = self.context['request'].user
        body = attrs.get('body', '').strip()
        if not body:
            raise serializers.ValidationError({'body': 'Message cannot be empty.'})
        attrs['body'] = body

        if sender.role == 'disabled':
            if sender.registered_doctor_id is None:
                raise serializers.ValidationError(
                    'You need a registered doctor before you can send a '
                    'message. Please add one from your profile.'
                )
            attrs['recipient'] = sender.registered_doctor
            attrs.pop('recipient_username', None)
        else:
            recipient_username = attrs.pop('recipient_username', None)
            if not recipient_username:
                raise serializers.ValidationError(
                    {'recipient_username': 'Select a patient to message.'}
                )
            from accounts.models import User
            try:
                recipient = User.objects.get(
                    username=recipient_username,
                    role=User.Role.DISABLED,
                    registered_doctor=sender,
                )
            except User.DoesNotExist:
                raise serializers.ValidationError(
                    {'recipient_username': 'That patient is not registered with you.'}
                )
            attrs['recipient'] = recipient

        return attrs

    def create(self, validated_data):
        sender = self.context['request'].user
        recipient = validated_data.pop('recipient')
        return Message.objects.create(
            sender=sender, recipient=recipient, **validated_data,
        )