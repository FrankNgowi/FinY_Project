from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


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