from rest_framework.permissions import BasePermission


class IsDisabledUser(BasePermission):
    message = 'Only disabled-user accounts can request appointments.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'disabled'
        )


class IsOwningDoctor(BasePermission):
    """Object-level: only the doctor an appointment is routed to may
    confirm or decline it."""

    message = 'This appointment is not routed to you.'

    def has_object_permission(self, request, view, obj):
        return bool(
            request.user
            and request.user.is_authenticated
            and obj.doctor_id == request.user.id
        )