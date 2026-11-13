from rest_framework.exceptions import PermissionDenied
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


class IsAdmin(BasePermission):
    message = 'Only admins can perform this action.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsVerifiedDoctor(IsDoctor):
    """A doctor whose certificate has been approved. Everyone else is refused; an unapproved
    doctor gets a code the apps use to send them to the verification screen."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.user.verification_status != 'approved':
            raise PermissionDenied({
                'detail': 'Your account is awaiting verification.',
                'code': 'verification_required',
            })
        return True


class IsDisabledOrVerifiedDoctor(BasePermission):
    """For endpoints a patient and their doctor both use (alerts, appointments, messages).
    Admins are refused; an unapproved doctor gets the verification_required code."""

    message = 'Only patients and verified doctors can use this.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == 'disabled':
            return True
        return IsVerifiedDoctor().has_permission(request, view)
