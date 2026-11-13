from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import DoctorVerification, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        'username', 'role', 'first_name', 'last_name', 'area', 'registered_doctor',
    )
    list_filter = ('role', 'area')
    fieldsets = DjangoUserAdmin.fieldsets + (
        ('Dikonekti profile', {
            'fields': (
                'role', 'middle_name', 'area', 'disability_type',
                'specialization', 'registered_doctor',
            ),
        }),
    )


@admin.register(DoctorVerification)
class DoctorVerificationAdmin(admin.ModelAdmin):
    """Read-only here. Decisions are made through the app's review screen, because they
    also clear a revoked doctor from their patients, which an edit in this form would skip.
    The document itself is not shown: it is private and has no URL."""

    list_display = ('user', 'status', 'submitted_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('user__username',)
    readonly_fields = (
        'user', 'status', 'submitted_at', 'rejection_reason', 'reviewed_by', 'reviewed_at',
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
