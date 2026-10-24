from django.contrib import admin
from calls.models import Call


@admin.register(Call)
class CallAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'caller',
        'callee',
        'call_type',
        'status',
        'duration',
        'started_at',
        'ended_at',
        'created_at',
    )
    list_filter = ('call_type', 'status', 'created_at')
    search_fields = ('caller__email', 'callee__email', 'caller__name', 'callee__name')
    readonly_fields = ('created_at', 'updated_at', 'duration')
    ordering = ('-created_at',)
