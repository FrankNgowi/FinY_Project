from rest_framework.permissions import BasePermission


class IsDisabledUser(BasePermission):
    message = 'Only disabled-user accounts can send emergency alerts.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'disabled'
        )


class IsOwningDoctor(BasePermission):
    """Object-level check: only the doctor an alert is routed to may
    acknowledge it — closes off one doctor acknowledging another's
    patient's alert by guessing/incrementing an ID in the URL."""

    message = 'This alert is not routed to you.'

    def has_object_permission(self, request, view, obj):
        return bool(
            request.user
            and request.user.is_authenticated
            and obj.doctor_id == request.user.id
        )