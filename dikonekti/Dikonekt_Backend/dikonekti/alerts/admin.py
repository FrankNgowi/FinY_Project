from django.contrib import admin

from .models import EmergencyAlert


@admin.register(EmergencyAlert)
class EmergencyAlertAdmin(admin.ModelAdmin):
    list_display = ('patient', 'doctor', 'timestamp', 'acknowledged')
    list_filter = ('acknowledged',)
    readonly_fields = ('timestamp',)