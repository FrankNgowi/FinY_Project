from rest_framework.permissions import BasePermission


class IsDoctor(BasePermission):
    message = 'Only doctors can perform this action.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'doctor'
        )


class IsDisabledUser(BasePermission):
    message = 'Only disabled-user accounts can perform this action.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'disabled'
        )